import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeFunctionResult, encodeAbiParameters } from "viem";
const f = vi.hoisted(() => ({
  readContract: vi.fn(),
  chain: 31611,
  count: 21n,
  wrongOwner: false,
}));
vi.mock("./musd", () => ({
  getPublicClient: () => ({
    readContract: f.readContract,
    getChainId: async () => f.chain,
    getBlockNumber: async () => 90n,
  }),
}));
import { readMezoLocks, timeToUnlock } from "./locks";
import { LOCK_CONTRACTS } from "./wealth/contracts";
const owner = "0x1111111111111111111111111111111111111111";
beforeEach(() => {
  vi.resetAllMocks();
  f.chain = 31611;
  f.count = 21n;
  f.wrongOwner = false;
  f.readContract.mockImplementation(async ({ address, abi, functionName, args }) => {
    const btc = address.toLowerCase() === LOCK_CONTRACTS.btc.escrow.toLowerCase();
    if (functionName === "token") return btc ? LOCK_CONTRACTS.btc.asset.address : LOCK_CONTRACTS.mezo.asset.address;
    if (functionName === "balanceOf") return f.count;
    if (functionName === "ownerToNFTokenIdList") return args[1] + 1n;
    if (functionName === "ownerOf")
      return f.wrongOwner
        ? "0x2222222222222222222222222222222222222222"
        : owner;
    const data = btc
      ? encodeAbiParameters([{ type: "int128" }, { type: "uint256" }, { type: "bool" }], [20n * 10n ** 18n, 1794441600n, args[0] === 21n])
      : encodeAbiParameters([{ type: "int128" }, { type: "uint256" }, { type: "bool" }, { type: "uint256" }], [20n * 10n ** 18n, 1794441600n, args[0] === 21n, 0n]);
    return decodeFunctionResult({ abi, functionName: "locked", data });
  });
});
describe("owned BTC and previous MEZO positions", () => {
  it("reads the correct escrow and return format for each asset", async () => {
    f.count = 1n;
    await readMezoLocks(owner);
    expect(f.readContract.mock.calls.every(([call]) => call.address === LOCK_CONTRACTS.btc.escrow)).toBe(true);
    f.readContract.mockClear();
    await readMezoLocks(owner, 0, "mezo");
    expect(f.readContract.mock.calls.every(([call]) => call.address === LOCK_CONTRACTS.mezo.escrow)).toBe(true);
  });
  it("bounds enumeration and pins every read to one block", async () => {
    const first = await readMezoLocks(owner);
    expect(first.locks).toHaveLength(20);
    expect(first.hasNext).toBe(true);
    expect(
      f.readContract.mock.calls.every(([call]) => call.blockNumber === 90n),
    ).toBe(true);
    const last = await readMezoLocks(owner, 1);
    expect(last.locks).toEqual([
      { tokenId: "21", amount: "20", unlockAt: null, permanent: true },
    ]);
    expect(last.hasNext).toBe(false);
  });
  it("refuses mismatched ownership, network and invalid pagination", async () => {
    f.wrongOwner = true;
    await expect(readMezoLocks(owner)).rejects.toThrow("ownership");
    f.chain = 31612;
    await expect(readMezoLocks(owner)).rejects.toThrow("testnet");
    f.chain = 31611;
    await expect(readMezoLocks(owner, -1)).rejects.toThrow("page");
  });
  it("distinguishes empty wallets, permanent locks, and expired positions", async () => {
    f.count = 0n;
    expect((await readMezoLocks(owner)).locks).toEqual([]);
    expect(timeToUnlock(null, 0)).toBe("Permanent lock");
    expect(timeToUnlock("2020-01-01T00:00:00Z", Date.now())).toBe(
      "Ready to unlock",
    );
  });
});
