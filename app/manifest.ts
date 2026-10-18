import type { MetadataRoute } from "next";

/**
 * The web app manifest.
 *
 * `start_url` is the app, not the marketing page: someone who installs Pocket
 * wants their wallet, not a pitch. `display: "standalone"` is what removes the
 * browser chrome the gate promises to remove — the installed window has no
 * address bar, no tab strip, and no back button that closes the wallet.
 *
 * No `orientation` lock. The app is designed portrait, but the desktop site
 * exists and locking a desktop install to portrait would be a bug.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pocket — mUSD wallet",
    short_name: "Pocket",
    description:
      "Send, request and borrow against mUSD from a wallet only you control.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#f4f4f6",
    theme_color: "#f4f4f6",
    categories: ["finance"],
    icons: [
      {
        src: "/icons/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
