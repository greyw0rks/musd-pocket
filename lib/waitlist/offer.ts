/** The approved Pocket testnet pilot, shared by the button and invoice service. */
export const WAITLIST_OFFER = {
  campaign: "pocket-mainnet-waitlist-testnet-v1",
  merchantUsername: "musd_pocket",
  merchantWallet: "0x0a5e59ca4f182561de80172c6da5db927091ea29",
  merchantName: "Pocket",
  description: "Pocket closed-mainnet waitlist (Mezo testnet pilot)",
  amount: "100",
  chainId: 31611,
} as const;
