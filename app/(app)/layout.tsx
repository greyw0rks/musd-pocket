import { Providers } from "@/app/providers";
import { AuthGate } from "@/components/auth-gate";
import { InstallGate } from "@/components/install/install-gate";
/*
  The app's own stylesheet, and it has to be imported by a route — nothing else
  pulls it in.

  Until the demo was deleted this import lived in `app/app/layout.tsx`, which
  happened to be the only file that referenced it. Purging `/app` therefore
  took the app's CSS with it, and the failure was not obvious: every request
  still answered 200 and the whole data layer still loaded, because the
  components were rendering correctly into a document that had no rules for
  them. `AppShell` sizes its children through `.pk-app`, and `PocketApp` draws
  every screen `absolute inset-0` inside that box — so with no stylesheet the
  box had zero height and the app was a white screen with a working backend
  behind it.

  It is imported here rather than in the root layout on purpose: `pocket.css`
  is unlayered, so its rules outrank Tailwind's layered utilities document-wide,
  and pulling it into `app/layout.tsx` would let it reach the marketing page.
  This layout is the smallest scope that contains every consumer.
*/
import "@/components/pocket/pocket.css";

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
 *
 * `InstallGate` sits outside `AuthGate` on purpose: the install decision is
 * made before signing in, so the session is created in the window it will live
 * in. It renders nothing until the browser state is known, and it never blocks
 * a desktop visitor — see the component for why.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <InstallGate>
        <AuthGate>{children}</AuthGate>
      </InstallGate>
    </Providers>
  );
}
