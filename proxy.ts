import { NextResponse, type NextRequest } from "next/server";

/**
 * The seal, reduced to what still needs sealing.
 *
 * This file used to hide the entire app (`/home`, `/pay`, the eight desktop
 * screens) and every API route behind it, because only the marketing surface
 * was finished and the rest was half-built but publicly reachable. The app has
 * since shipped, so the parts that were sealed for being *unfinished* are now
 * public on purpose.
 *
 * What remains is the one route sealed for a different reason. `/spike` is a
 * Phase-0 relayer proof: a page that spends the BTC-funded hot wallet to
 * demonstrate gasless receive. It is not a product surface and must not be
 * reachable on the production domain — so it redirects to the landing page,
 * ahead of routing.
 *
 * The API routes are not listed here anymore, and that is safe rather than
 * merely convenient: each one authenticates itself. The app routes call
 * `requireIdentity` and derive the owner or creator from the token — never from
 * a query parameter — and `/api/cron/reconcile` checks `CRON_SECRET` itself.
 * They had to be let through for the app to work at all: a `fetch()` from the
 * browser cannot follow a redirect to the marketing page.
 */

/** Not a product surface: a device-only proof that spends a real hot wallet. */
const HIDDEN_SCREENS = ["/spike"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isHidden = HIDDEN_SCREENS.some(
    (screen) => pathname === screen || pathname.startsWith(`${screen}/`),
  );
  if (isHidden) return NextResponse.redirect(new URL("/", request.url));

  return NextResponse.next();
}

export const config = {
  // Everything under `_next` is Next's own machinery — assets, the image
  // optimiser, and the dev HMR socket. Intercepting those breaks hot reload,
  // so they are excluded wholesale rather than one path at a time.
  matcher: ["/((?!_next|favicon.ico).*)"],
};
