import { PocketApp } from "@/components/pocket/PocketApp";

/**
 * The interactive demo.
 *
 * Mounted beside the marketing page rather than replacing it: `/` still sells
 * the product, `/app` lets someone use it. Nothing here talks to a chain, a
 * wallet, or a database — see `features/payments` for the boundary.
 */
export default function PocketDemoPage() {
  return <PocketApp />;
}
