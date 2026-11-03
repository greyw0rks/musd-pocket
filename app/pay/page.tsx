import Link from "next/link";

export default function PayIndex() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-semibold">Open a payment link</h1>
      <p className="my-4">
        Use the complete link or QR code shared by the person requesting
        payment.
      </p>
      <Link className="underline" href="/home">
        Back to Pocket
      </Link>
    </main>
  );
}
