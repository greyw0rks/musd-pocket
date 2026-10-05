import { Providers } from "@/app/providers";

/**
 * /spike is the Privy × Mezo harness — it needs the full wallet stack, which
 * the root layout no longer provides (so the landing page stays wallet-free).
 */
export default function SpikeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
