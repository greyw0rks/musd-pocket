export const GREYLABS = {
  id: "greylabs",
  name: "Greylabs",
  offer: "10–30% off merch",
  shopUrl: "https://mpocket.tech/merchants/greylabs",
  username: "grey_labs",
  handle: "@grey_labs",
} as const;
export type GreylabsCoupon = { code: string; percent: number; merchant: string; createdAt: string };
export type GreylabsAccess = { eligible: boolean; recipient: import("@/features/payments/payment.types").Recipient | null; coupon: GreylabsCoupon | null };
