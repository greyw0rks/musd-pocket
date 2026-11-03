import { beforeEach, describe, expect, it, vi } from "vitest";
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
const owner = "0x1111111111111111111111111111111111111111";
beforeEach(() => {
  vi.resetAllMocks();
  f.chain = 31611;
  f.count = 21n;
  f.wrongOwner = false;
  f.readContract.mockImplementation(async ({ functionName, args }) => {
    if (functionName === "balanceOf") return f.count;
    if (functionName === "ownerToNFTokenIdList") return args[1] + 1n;
    if (functionName === "ownerOf")
      return f.wrongOwner
        ? "0x2222222222222222222222222222222222222222"
        : owner;
    return {
      amount: 20n * 10n ** 18n,
      end: 1794441600n,
      isPermanent: args[0] === 21n,
      boost: 0n,
    };
  });
});
describe("owned veMEZO positions", () => {
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
