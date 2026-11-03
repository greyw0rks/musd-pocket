import { notFound } from "next/navigation";
import { Checkout } from "@/components/checkout/Checkout";
import { normalizeRequestId } from "@/lib/requests/links";
import { Providers } from "@/app/providers";
import { AuthGate } from "@/components/auth-gate";

export default async function PayPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const id = normalizeRequestId((await params).shortId);
  if (!id) notFound();
  // Validate before the authentication gate. Invalid links must show their
  // error even when the visitor has not signed in yet.
  return (
    <Providers>
      <AuthGate>
        <Checkout shortId={id} />
      </AuthGate>
    </Providers>
  );
}
