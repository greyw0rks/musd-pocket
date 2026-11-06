export const GREYLABS = {
  id: "greylabs",
  name: "Greylabs",
  offer: "10–30% off merch",
  shopUrl: "https://mpocket.tech/merchants/greylabs",
} as const;
export type GreylabsCoupon = { code: string; percent: number; merchant: string; createdAt: string };
