"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

/** Renders a URL as a crisp QR onto a canvas (high error correction for demos). */
export function QRCodeView({
  value,
  size = 220,
}: {
  value: string;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#151716", light: "#ffffff" },
    }).catch(() => {});
  }, [value, size]);

  return (
    <div className="inline-flex items-center justify-center rounded-xl border border-border bg-white p-3">
      <canvas ref={ref} width={size} height={size} aria-label="Payment QR code" />
    </div>
  );
}
