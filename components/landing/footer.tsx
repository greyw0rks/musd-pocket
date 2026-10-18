import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { NETWORK, TICKER } from "@/components/landing/constants";

const NAV = [
  {
    heading: "Product",
    links: [
      { href: "#why", label: "Why Pocket" },
      { href: "#how-it-works", label: "How it works" },
      { href: "#merchants", label: "For merchants" },
    ],
  },
  {
    heading: "Get started",
    links: [
      /*
        "Early access" was here, pointing at `/waitlist`. The app is open now,
        so the only honest action is the one that opens it. The old route still
        exists for links that were already shared, but it redirects to `/home`
        rather than collecting an address nobody needs to leave.
      */
      { href: "/home", label: "Open Pocket" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Wordmark className="text-lg" />
          <p className="mt-4 max-w-xs text-sm text-muted text-pretty">
            Spend your Bitcoin without selling it. {TICKER} payments on{" "}
            {NETWORK}.
          </p>
        </div>

        {NAV.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
              {group.heading}
            </h3>
            <ul className="mt-4 flex flex-col gap-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:rounded"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} {TICKER} Pocket</p>
          <p>One balance, settled behind the scenes.</p>
        </div>
      </div>
    </footer>
  );
}
