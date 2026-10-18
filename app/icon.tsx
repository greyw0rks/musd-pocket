import { ImageResponse } from "next/og";
import { palette } from "@/lib/brand/tokens";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/**
 * Browser tab icon: the brand-purple "pocket." mark.
 *
 * The ground is the brand accent, not Mezo orange. The icon is the product's
 * face on a tab or a home screen; painting it in the partner's colour made the
 * chain look like the product.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: palette.light.p,
          borderRadius: 14,
          color: "#FFFFFF",
          fontSize: 42,
          fontWeight: 700,
          fontFamily: "sans-serif",
          paddingBottom: 6,
        }}
      >
        p
      </div>
    ),
    size,
  );
}
