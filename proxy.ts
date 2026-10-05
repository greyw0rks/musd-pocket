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
    if (PUBLIC_API_ROUTES.has(pathname)) return NextResponse.next();
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isHidden = HIDDEN_SCREENS.some(
    (screen) => pathname === screen || pathname.startsWith(`${screen}/`),
  );
  if (isHidden) return NextResponse.redirect(new URL("/", request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
