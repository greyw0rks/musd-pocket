import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Browser tab icon: the Mezo-orange "pocket." mark. */
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
          background: "#FF5A36",
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
