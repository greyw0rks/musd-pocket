import { cn } from "@/lib/utils";

const GRID = 25;

/**
 * A deterministic, non-scannable QR *illustration* for the marketing mockups.
 * Zero JS and no `qrcode` dependency in the landing bundle. The real, scannable
 * code is rendered by components/ui/qr-code.tsx inside the app.
 */
function moduleFilled(x: number, y: number): boolean {
  const h = (x * 73856093) ^ (y * 19349663);
  return ((h >>> 3) & 7) > 3;
}

function inFinder(x: number, y: number): boolean {
  return x < 7 && y < 7 || x >= GRID - 7 && y < 7 || x < 7 && y >= GRID - 7;
}

function finderFilled(x: number, y: number): boolean {
  const origin = (ox: number, oy: number) => {
    const ring = Math.max(Math.abs(x - ox - 3), Math.abs(y - oy - 3));
    return ring !== 2; // 7×7 solid border fused to a 3×3 core
  };
  if (x < 7 && y < 7) return origin(0, 0);
  if (x >= GRID - 7 && y < 7) return origin(GRID - 7, 0);
  return origin(0, GRID - 7);
}

export function QrMock({
  className,
  title = "Payment QR code",
}: {
  className?: string;
  title?: string;
}) {
  const modules: React.ReactElement[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const dark = inFinder(x, y) ? finderFilled(x, y) : moduleFilled(x, y);
      if (dark) {
        modules.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
      }
    }
  }

  return (
    // Matches the real QR's colours in components/ui/qr-code.tsx (#151716 on white)
    <svg
      viewBox={`0 0 ${GRID} ${GRID}`}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
      className={cn("fill-[#151716]", className)}
    >
      <title>{title}</title>
      <rect width={GRID} height={GRID} className="fill-white" />
      <g>{modules}</g>
    </svg>
  );
}
