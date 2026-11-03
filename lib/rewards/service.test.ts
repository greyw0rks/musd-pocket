import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeFunctionData, zeroAddress } from "viem";
import {
  MEZO_REWARD_TOKEN,
  TESTNET_VEMEZO,
  WELCOME_LOCK_DURATION,
  WELCOME_MEZO_AMOUNT,
  WELCOME_REWARD_ABI,
  epochUnlockAt,
} from "./abi";

vi.mock("server-only", () => ({}));
const fixture = vi.hoisted(() => ({
  campaign: "0x1111111111111111111111111111111111111111",
  relayer: "0x2222222222222222222222222222222222222222",
  wallet: "0x3333333333333333333333333333333333333333" as `0x${string}`,
  hash: `0x${"a".repeat(64)}`,
  attempt: null as null | { state: string; txHash: string | null },
  claimed: false,
  wrongToken: false,
  paused: false,
  inventory: 600n * 10n ** 18n,
  readContract: vi.fn(),
  simulateContract: vi.fn(),
  writeContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  signTypedData: vi.fn(),
  getTransaction: vi.fn(),
  getTransactionReceipt: vi.fn(),
}));

vi.mock("./attempts", () => ({
  attemptId: () => "claim-attempt",
  readAttempt: async () => fixture.attempt,
  reserveAttempt: async () => {
    if (fixture.attempt && fixture.attempt.state !== "RETRYABLE") return false;
    fixture.attempt = { state: "SENDING", txHash: null };
    return true;
  },
  recordBroadcast: async (_id: string, txHash: string) => {
    fixture.attempt = { state: "BROADCAST", txHash };
  },
  allowRetry: async () => {
    if (fixture.attempt) fixture.attempt.state = "RETRYABLE";
  },
}));

vi.mock("@/lib/mezo/musd", () => ({
  getPublicClient: () => ({
    getChainId: async () => 31611,
    getBlock: async () => ({ number: 16492615n, timestamp: 1793480400n }),
    getBalance: async () => 10n ** 18n,
    readContract: fixture.readContract,
    simulateContract: fixture.simulateContract,
    waitForTransactionReceipt: fixture.waitForTransactionReceipt,
    getTransaction: fixture.getTransaction,
    getTransactionReceipt: fixture.getTransactionReceipt,
  }),
}));
vi.mock("@/lib/relayer", () => ({
  hasRelayer: () => true,
  getRelayerWallet: () => ({
    account: { address: fixture.relayer, signTypedData: fixture.signTypedData },
    client: { writeContract: fixture.writeContract },
  }),
}));

import {
  claimWelcomeReward,
  welcomeClaimId,
  welcomeRewardStatus,
} from "./service";
const identity = {
  privyId: "did:privy:test-account",
  walletAddress: fixture.wallet,
  xId: null,
  xHandle: null,
  avatarUrl: null,
  telegramId: null,
  telegramHandle: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.POCKET_WELCOME_REWARD_ADDRESS = fixture.campaign;
  process.env.POCKET_WELCOME_REWARD_CHAIN_ID = "31611";
  fixture.attempt = null;
  fixture.claimed = false;
  fixture.wrongToken = false;
  fixture.paused = false;
  fixture.inventory = 600n * 10n ** 18n;
  fixture.readContract.mockImplementation(
    async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case "rewardToken":
          return fixture.wrongToken ? fixture.wallet : MEZO_REWARD_TOKEN;
        case "votingEscrow":
          return TESTNET_VEMEZO;
        case "authorizer":
          return fixture.relayer;
        case "rewardAmount":
          return WELCOME_MEZO_AMOUNT;
        case "lockDuration":
          return WELCOME_LOCK_DURATION;
        case "paused":
          return fixture.paused;
        case "claims":
          return [
            fixture.claimed ? fixture.wallet : zeroAddress,
            42n,
            WELCOME_MEZO_AMOUNT,
            1794441600n,
          ];
        case "walletClaimed":
          return fixture.claimed;
        case "token":
          return MEZO_REWARD_TOKEN;
        case "decimals":
          return 18;
        case "balanceOf":
          return fixture.inventory;
        default:
          throw new Error(`Unexpected read ${functionName}`);
      }
    },
  );
  fixture.simulateContract.mockResolvedValue({
    request: { address: fixture.campaign },
  });
  fixture.signTypedData.mockResolvedValue("0x1234");
  fixture.writeContract.mockResolvedValue(fixture.hash);
  fixture.waitForTransactionReceipt.mockImplementation(async () => {
    fixture.claimed = true;
    return { status: "success" };
  });
});

describe("welcome reward funding and recovery", () => {
  it("disables an unconfigured campaign and never signs", async () => {
    delete process.env.POCKET_WELCOME_REWARD_ADDRESS;
    expect((await welcomeRewardStatus(identity)).state).toBe("unavailable");
    await expect(claimWelcomeReward(identity)).rejects.toMatchObject({
      status: 503,
    });
    expect(fixture.signTypedData).not.toHaveBeenCalled();
  });
  it("refuses the wrong network or asset before signing", async () => {
    process.env.POCKET_WELCOME_REWARD_CHAIN_ID = "31612";
    await expect(claimWelcomeReward(identity)).rejects.toMatchObject({
      status: 503,
    });
    process.env.POCKET_WELCOME_REWARD_CHAIN_ID = "31611";
    fixture.wrongToken = true;
    await expect(claimWelcomeReward(identity)).rejects.toMatchObject({
      status: 503,
    });
    expect(fixture.signTypedData).not.toHaveBeenCalled();
  });
  it("returns an unavailable state for insufficient inventory without a payout", async () => {
    fixture.inventory = WELCOME_MEZO_AMOUNT - 1n;
    expect((await welcomeRewardStatus(identity)).reason).toMatch(/restocked/);
    await expect(claimWelcomeReward(identity)).rejects.toMatchObject({
      status: 503,
    });
    expect(fixture.writeContract).not.toHaveBeenCalled();
  });
  it("binds the voucher to the authenticated account, wallet, network and campaign", async () => {
    const result = await claimWelcomeReward(identity);
    expect(fixture.signTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: expect.objectContaining({
          chainId: 31611,
          verifyingContract: fixture.campaign,
        }),
        message: expect.objectContaining({
          claimId: welcomeClaimId(identity.privyId),
          recipient: fixture.wallet,
        }),
      }),
    );
    expect(result.state).toBe("claimed");
    expect(result.claim?.amount).toBe("20");
  });
  it("recovers a completed claim after a restart without signing another transaction", async () => {
    fixture.claimed = true;
    fixture.inventory = 0n;
    fixture.paused = true;
    expect((await claimWelcomeReward(identity)).state).toBe("claimed");
    expect(fixture.signTypedData).not.toHaveBeenCalled();
    expect(fixture.writeContract).not.toHaveBeenCalled();
  });
  it("retains a broadcast hash on timeout without claiming confirmation", async () => {
    fixture.waitForTransactionReceipt.mockRejectedValue(
      new Error("RPC timeout"),
    );
    const result = await claimWelcomeReward(identity);
    expect(result.pendingTxHash).toBe(fixture.hash);
    expect(result.state).toBe("available");
    expect(result.claim).toBeNull();
  });
  it("unblocks a matching pending transaction that reverted", async () => {
    fixture.getTransaction.mockResolvedValue({
      to: fixture.campaign,
      input: encodeFunctionData({
        abi: WELCOME_REWARD_ABI,
        functionName: "claim",
        args: [
          welcomeClaimId(identity.privyId),
          fixture.wallet,
          1793480700n,
          "0x1234",
        ],
      }),
    });
    fixture.getTransactionReceipt.mockResolvedValue({ status: "reverted" });
    const result = await welcomeRewardStatus(identity, fixture.hash);
    expect(result.pendingStatus).toBe("reverted");
    expect(result.pendingTxHash).toBeUndefined();
    expect(result.state).toBe("available");
  });
  it("does not attribute someone else's transaction to this welcome claim", async () => {
    fixture.getTransaction.mockResolvedValue({
      to: fixture.relayer,
      input: "0x",
    });
    const result = await welcomeRewardStatus(identity, fixture.hash);
    expect(result.pendingTxHash).toBeUndefined();
    expect(fixture.getTransactionReceipt).not.toHaveBeenCalled();
  });
  it("treats a failed read as unknown, never an available zero reward", async () => {
    fixture.readContract.mockRejectedValue(new Error("RPC offline"));
    const result = await welcomeRewardStatus(identity);
    expect(result.state).toBe("unavailable");
    expect(result.rewardAmount).toBeNull();
  });
  it("keeps an ambiguous broadcast reserved and never resends it", async () => {
    fixture.writeContract.mockRejectedValue(new Error("RPC disconnected"));
    expect((await claimWelcomeReward(identity)).state).toBe("unavailable");
    expect((await claimWelcomeReward(identity)).state).toBe("unavailable");
    expect(fixture.writeContract).toHaveBeenCalledTimes(1);
  });
  it("recovers a pending hash from the server journal after a browser restart", async () => {
    fixture.attempt = { state: "BROADCAST", txHash: fixture.hash };
    fixture.getTransaction.mockResolvedValue({
      to: fixture.campaign,
      input: encodeFunctionData({
        abi: WELCOME_REWARD_ABI,
        functionName: "claim",
        args: [
          welcomeClaimId(identity.privyId),
          fixture.wallet,
          1793480700n,
          "0x1234",
        ],
      }),
    });
    fixture.getTransactionReceipt.mockRejectedValue(new Error("pending"));
    expect((await claimWelcomeReward(identity)).pendingTxHash).toBe(
      fixture.hash,
    );
    expect(fixture.writeContract).not.toHaveBeenCalled();
  });
  it("previews the actual weekly boundary rather than adding eleven days", () => {
    expect(epochUnlockAt(1793480400n, WELCOME_LOCK_DURATION)).toBe(1794441600n);
    expect(epochUnlockAt(1793232000n, WELCOME_LOCK_DURATION)).toBe(1794441600n);
  });
});
