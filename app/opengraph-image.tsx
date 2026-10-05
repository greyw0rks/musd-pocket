import { ImageResponse } from "next/og";

export const alt = "Pocket — Spend your Bitcoin without selling it";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social card. Rendered with inline styles (ImageResponse has no Tailwind), in
 * the dark Mezo palette from the brief — OG images are one place the dark look
 * is unambiguously right regardless of the site's theme default.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0A0A",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 34, color: "#A3A3A0", fontWeight: 600 }}>
            mUSD
          </span>
          <span style={{ fontSize: 34, color: "#F5F5F0", fontWeight: 600 }}>
            pocket
          </span>
          <span style={{ fontSize: 34, color: "#FF5A36", fontWeight: 700 }}>
            .
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            maxWidth: 900,
          }}
        >
          <div
            style={{
              fontSize: 76,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "#F5F5F0",
              fontWeight: 700,
            }}
          >
            Spend your Bitcoin without selling it.
          </div>
          <div style={{ fontSize: 30, color: "#A3A3A0" }}>
            Send, request, and pay from one simple pocket.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 26,
            color: "#A3A3A0",
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 9999,
              background: "#FF5A36",
            }}
          />
          Built on Mezo
        </div>
      </div>
    ),
    size,
  );
}
