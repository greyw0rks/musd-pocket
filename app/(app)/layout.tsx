import { Providers } from "@/app/providers";
import { AuthGate } from "@/components/auth-gate";

/**
 * The authenticated surface — one route, `/home`.
 *
 * This group used to hold eight desktop pages behind `AppShell`, a sidebar
 * chrome with a URL per page. The app that shipped is the mobile one, a stack
 * router with a single entry point, so the eight URLs are aliases now, declared
 * in `next.config.ts` and resolved before routing gets here.
 *
 * `AppShell` and the desktop screens are not deleted; they are left on disk,
 * unreferenced, so removing them is one deliberate change with one reason
 * rather than a side effect of this one.
 *
 * `AuthGate` is load-bearing beyond keeping strangers out: it resolves the
 * session and renders nothing until it has, which is what lets `/home` build
 * its services from an already-loaded user instead of racing the first fetch.
 * It also means nothing in this group renders on the server, so the alias
 * redirects above cannot live inside these pages.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <AuthGate>{children}</AuthGate>
    </Providers>
  );
}
