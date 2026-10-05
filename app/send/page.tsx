import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function SendPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          Send MUSD
        </h1>
        <p className="mb-6 text-muted max-w-xl">
          Send MUSD to anyone with just their username or wallet address.
        </p>
        <div className="space-y-4 md:flex md:items-center md:justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-mezo px-6 py-3 text-[15px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-mezo-dark"
          >
            Back to Home
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
