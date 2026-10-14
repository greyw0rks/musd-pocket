import { NextResponse, type NextRequest } from "next/server";

/**
 * TEMPORARY — delete this file when the app ships.
 *
 * Only the marketing surface is finished, so everything else is sealed off
 * before a request ever reaches a route. Without this, the half-built app
 * screens and their APIs are publicly reachable on the production domain.
 *
 * Public: `/`, `/waitlist`, `POST /api/waitlist`, and the generated
 * `opengraph-image` / `icon` routes (matcher excludes static assets).
 */

/** The only API endpoint the landing page needs. */
const PUBLIC_API_ROUTES = new Set(["/api/waitlist"]);

/**
 * Machine endpoints — not for browsers, and not unauthenticated. They are let
 * through the seal because the caller is a scheduler, not a session, so the
 * checks below (and the app's own auth) cannot apply to them. Each one
 * authenticates itself: the cron routes require `Authorization: Bearer
 * $CRON_SECRET` and answer 401 otherwise. Without an entry here they would 404
 * before reaching their own handler, and the scheduler would fail silently.
 */
const MACHINE_API_ROUTES = new Set(["/api/cron/reconcile"]);

/** App screens that are not ready to be seen. */
const HIDDEN_SCREENS = [
  "/home",
  "/pay",
  "/wallet",
  "/activity",
  "/deposit",
  "/withdraw",
  "/receive",
  "/send",
  "/settings",
  "/spike",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // App APIs 404 rather than redirect: a redirect would hand HTML to a fetch().
  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API_ROUTES.has(pathname) || MACHINE_API_ROUTES.has(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
