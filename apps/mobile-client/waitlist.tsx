import { useEffect, useState } from "react";
import { WaitlistCheckout as Checkout } from "../../components/checkout/WaitlistCheckout";

/** The local pilot UI is usable only after its POST endpoint is deployed. */
export function WaitlistCheckout({ compact = false }: { compact?: boolean } = {}) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    // GET performs no invoice creation. The POST-only Next route answers 405;
    // an undeployed route answers 404. Wallet screens never wait for this probe.
    fetch("/api/waitlist/checkout", { cache: "no-store", signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setAvailable(response.status === 405); })
      .catch(() => {})
      .finally(() => window.clearTimeout(timer));
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, []);
  return available ? <Checkout compact={compact} /> : null;
}
