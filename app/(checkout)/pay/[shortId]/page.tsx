import { Checkout } from "@/components/checkout/Checkout";
export const metadata = { title: "Pay in mUSD · Pocket", robots: { index: false, follow: false } };
export default async function PayPage({ params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await params;
  return <Checkout shortId={shortId} />;
}
