import type { NextConfig } from "next";

/**
 * The mobile app lives at `/home` and nowhere else.
 *
 * These paths were the desktop app's routes — a sidebar with eight parallel
 * pages, each with its own URL — plus `/app`, which was the app's own address
 * while a demo lived beside it. The app that shipped is a stack router: one
 * entry point, screens pushed on top of each other with no address of their
 * own. So `wallet`, `activity` and the rest are not places anymore, and the
 * URLs point at the one place that is.
 *
 * This is a config redirect rather than a `redirect()` call inside each page,
 * and that is not a style preference — the page-level version silently does
 * nothing here. Every `(app)` route sits behind `AuthGate`, which renders
 * nothing until Privy has resolved, and Privy only resolves in the browser. So
 * during the server render the page component never runs, `redirect()` never
 * fires, and the URL answers 200 with an empty body: a blank screen where a
 * redirect was promised. `redirects` runs before routing, so it does not care
 * what renders behind it.
 *
 * `permanent: false` — a temporary redirect. These URLs may come back if the
 * desktop surface does, and a permanent redirect is cached by browsers in a
 * way that is genuinely hard to undo.
 */
const ALIASES = [
  // `/app` was the app's own address for as long as there were two of them: a
  // demo mounted there and the real one at `/home`. The demo is gone and the
  // surviving app kept its URL, so `/app` is now the address of a thing that
  // still exists under another name — which is exactly what a redirect is for,
  // and an unhandled 404 is what it got instead. It is listed first because it
  // is the one people typed by habit, not because it is special.
  "/app",
  "/pay",
  "/wallet",
  "/activity",
  "/deposit",
  "/withdraw",
  "/receive",
  "/settings",
  // An orphan marketing stub ("Send MUSD") from before sending was built.
  // Nothing linked to it, and it only stayed invisible because the whole app
  // was sealed. Unsealing would have exposed it as a page promising a feature
  // it did not have.
  "/send",
];

const nextConfig: NextConfig = {
  async redirects() {
    return ALIASES.map((source) => ({
      source: `${source}/:path*`,
      destination: "/home",
      permanent: false,
    }));
  },
};

export default nextConfig;
