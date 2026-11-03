import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  type Address,
} from "viem";
import { CHAIN_ID, MUSD_ADDRESS } from "@/lib/mezo/config";
import { MUSD_ABI, parseMusd } from "@/lib/mezo/musd";
import { verifyCheckoutTransfer } from "./verify";

const rpc = vi.hoisted(() => ({
  getChainId: vi.fn(),
  getTransaction: vi.fn(),
  getTransactionReceipt: vi.fn(),
  getBlock: vi.fn(),
}));
vi.mock("@/lib/mezo/musd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mezo/musd")>()),
  getPublicClient: () => rpc,
}));

const sender = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";
const other = "0x3333333333333333333333333333333333333333";
const txHash = `0x${"a".repeat(64)}` as const;
const amount = "2.000000000000000001";
const transfer = (to: Address = recipient, value = parseMusd(amount)) =>
  encodeFunctionData({
    abi: MUSD_ABI,
    functionName: "transfer",
    args: [to, value],
  });
const transaction = () => ({
  hash: txHash,
  from: sender,
  to: MUSD_ADDRESS,
  value: 0n,
  input: transfer(),
  chainId: CHAIN_ID,
});
const log = () => ({
  address: MUSD_ADDRESS,
  topics: encodeEventTopics({
    abi: MUSD_ABI,
    eventName: "Transfer",
    args: { from: sender, to: recipient },
  }),
  data: encodeAbiParameters([{ type: "uint256" }], [parseMusd(amount)]),
});
const receipt = () => ({ status: "success", blockNumber: 123n, logs: [log()] });
const verify = () =>
  verifyCheckoutTransfer({ txHash, sender, recipient, amount });

beforeEach(() => {
  vi.resetAllMocks();
  rpc.getChainId.mockResolvedValue(CHAIN_ID);
  rpc.getTransaction.mockResolvedValue(transaction());
  rpc.getTransactionReceipt.mockResolvedValue(receipt());
  rpc.getBlock.mockResolvedValue({ timestamp: 1_800_000_000n });
});

describe("independent direct-transfer verification", () => {
  it("verifies exact 18-decimal calldata and a matching token event", async () => {
    expect(await verify()).toEqual({
      valid: true,
      from: sender,
      timestamp: 1_800_000_000n,
      blockNumber: 123n,
    });
  });
  it("refuses a misconfigured RPC network before reading a transfer", async () => {
    rpc.getChainId.mockResolvedValue(1);
    expect(await verify()).toMatchObject({ valid: false });
    expect(rpc.getTransaction).not.toHaveBeenCalled();
  });
  it("keeps unavailable hashes unverified", async () => {
    rpc.getTransaction.mockRejectedValue(new Error("Not found"));
    expect(await verify()).toMatchObject({
      valid: false,
      pending: true,
      verifiedIntent: false,
    });
  });
  it.each([
    { from: other },
    { to: other },
    { value: 1n },
    { input: transfer(other) },
    { input: transfer(recipient, parseMusd(amount) - 1n) },
    { input: "0x1234" },
    {
      input: encodeFunctionData({
        abi: MUSD_ABI,
        functionName: "balanceOf",
        args: [recipient],
      }),
    },
  ])("rejects a mismatching transaction %#", async (patch) => {
    rpc.getTransaction.mockResolvedValue({ ...transaction(), ...patch });
    expect(await verify()).toMatchObject({ valid: false });
    expect(rpc.getTransactionReceipt).not.toHaveBeenCalled();
  });
  it("holds only a readable matching transfer while awaiting a receipt", async () => {
    rpc.getTransactionReceipt.mockRejectedValue(new Error("Not mined yet"));
    expect(await verify()).toMatchObject({
      valid: false,
      pending: true,
      verifiedIntent: true,
    });
  });
  it("reports a confirmed revert separately from an unavailable receipt", async () => {
    rpc.getTransactionReceipt.mockResolvedValue({
      ...receipt(),
      status: "reverted",
    });
    expect(await verify()).toMatchObject({ valid: false, reverted: true });
    expect(rpc.getBlock).not.toHaveBeenCalled();
  });
  it.each(
    [
      [],
      [{ ...log(), address: other }],
      [{ ...log(), data: encodeAbiParameters([{ type: "uint256" }], [1n]) }],
      [
        {
          ...log(),
          topics: encodeEventTopics({
            abi: MUSD_ABI,
            eventName: "Transfer",
            args: { from: other, to: recipient },
          }),
        },
      ],
    ].map((logs) => ({ logs })),
  )("requires an exact token Transfer event", async ({ logs }) => {
    rpc.getTransactionReceipt.mockResolvedValue({ ...receipt(), logs });
    expect(await verify()).toMatchObject({
      valid: false,
      reason: expect.stringContaining("No matching"),
    });
  });
});
