// Explicit browser fixtures. These actions record intent locally and never sign or call a network.
const unit = 10n ** 18n;
const wei = (value) => (BigInt(value) * unit).toString();
window.financeCalls = [];
window.financeScenario = "funded";
window.financeHold = false;
const result = async (kind, amount) => {
  window.financeCalls.push({ kind, amount: amount?.toString() });
  if (window.financeHold)
    await new Promise((resolve) => setTimeout(resolve, 400));
  return { ok: true, hash: `0x${"1".repeat(64)}` };
};
export const useEarn = () => ({
  data: {
    principal: wei(100),
    shares: wei(100),
    hasPosition: true,
    claimableYield: window.financeScenario === "unread" ? null : wei(2),
    vaultAcceptsMusd: window.financeScenario !== "mismatch",
  },
  isPending: false,
  isError: false,
  isFetching: false,
  refetch: async () => {},
});
export const useEarnActions = () => ({
  deposit: (amount) => result("save", amount),
  withdraw: (amount) => result("withdraw", amount),
  claim: () => result("claim"),
  pendingClaimHash: () => null,
  hasPendingClaim: () => false,
  canRetryClaim: () => false,
});
export const useMusdBalance = () => ({
  raw: 50n * unit,
  refetch: async () => {},
});
export const useBorrow = () => ({
  data: {
    hasTrove: window.financeScenario !== "empty",
    statusLabel: window.financeScenario === "empty" ? "nonExistent" : "active",
    collateral: wei(1),
    debt: wei(3000),
    mcr: "1100000000000000000",
    price: window.financeScenario === "unread" ? null : wei(60000),
    collateralRatio: window.financeScenario === "unread" ? null : wei(20),
    ltv: window.financeScenario === "unread" ? null : "50000000000000000",
    liquidationPrice: wei(3300),
    health: "healthy",
  },
  isPending: false,
  isError: false,
  isFetching: false,
  refetch: async () => {},
});
export const useBorrowActions = () => ({
  terms: async () => ({
    minNetDebt: 2000n * unit,
    recovery: window.financeScenario === "recovery",
  }),
  fee: async () => 5n * unit,
  open: (input) => result("open", input.drawWei),
  repay: (amount) => result("repay", amount),
  close: () => result("close"),
});
export const useAccount = () => ({ address: `0x${"1".repeat(40)}` });
export const useBalance = () => ({ data: { value: unit } });
