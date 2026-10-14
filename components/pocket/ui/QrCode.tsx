"use client";

import QRCode from "qrcode";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

/** Light modules required on every side. From the spec, not a taste decision. */
const QUIET = 4;

/**
 * A real QR code.
 *
 * Real on purpose. A drawn grid that looks like a QR code but cannot be read is
 * the exact kind of prop this build keeps refusing — it would survive every
 * screenshot review and fail the first time someone pointed a phone at it.
 *
 * The payload is encoded here rather than fetched, and `QRCode.create` is
 * synchronous and pure, so this renders identically on the server and on the
 * client and needs no effect, no canvas and no loading state.
 *
 * `qrcode` is a dependency of this app already (it has a `browser` field that
 * stubs out `fs`), so this adds no weight that was not already installed.
 */
export function QrCode({
  value,
  size = 208,
  className,
  label,
}: {
  /** What the code encodes. Changing it re-encodes; nothing is memoised across values. */
  value: string;
  /** Rendered edge length in px. The module grid scales to fit exactly. */
  size?: number;
  className?: string;
  /** Described to a screen reader, since the code itself is not text. */
  label?: string;
}) {
  const { path, modules } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const count = qr.modules.size;

    // One path rather than one rect per dark module: a 33-module code is ~500
    // squares, and a single `d` attribute is markedly cheaper to diff and to
    // paint than 500 elements.
    let d = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!qr.modules.get(row, col)) continue;
        d += `M${col} ${row}h1v1h-1z`;
      }
    }

    return { path: d, modules: count };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label ?? "QR code"}
      width={size}
      height={size}
      viewBox={`${-QUIET} ${-QUIET} ${modules + QUIET * 2} ${modules + QUIET * 2}`}
      shapeRendering="crispEdges"
      className={cn("block", className)}
    >
      {/* The quiet zone is part of the spec, not padding. Four light modules on
          every side is what lets a scanner find the code's edges, so the
          viewBox extends past the module grid and the background fills that
          margin rather than it being CSS around the svg. */}
      <rect
        x={-QUIET}
        y={-QUIET}
        width={modules + QUIET * 2}
        height={modules + QUIET * 2}
        fill="#ffffff"
      />
      <path d={path} fill="#000000" />
    </svg>
  );
}
