import type { CSSProperties } from "react";
import { brand } from "@/lib/brand/tokens";

/**
 * The Pocket mark: two money cards rising out of a pocket.
 *
 * The home screen's first gesture is a pair of stacked balance cards — the
 * highlight card peeking out from behind the purple one. The mark turns that
 * same pair around and tucks it into a pocket, which is what the product is
 * named for and what it does: money you can reach for.
 *
 * It is drawn as boxes rather than an SVG on purpose. `next/og` renders the
 * favicon and the installable icons through Satori, whose CSS support is
 * intentionally small; this composition is entirely boxes, radii and fills,
 * which Satori renders exactly like the browser. One component therefore
 * produces the tab icon, the home-screen icon, the install gate's badge and the
 * brand-kit specimen — there is no second copy of the artwork to drift.
 *
 * Geometry is authored on a 512 grid and scaled from `size`, so the same
 * description survives a 16px tab and a 1024px store icon.
 */

const GRID = 512;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The card behind: the highlight, offset up and left. */
const BACK_CARD: Box = { x: 186, y: 140, w: 148, h: 118 };
/** The card in front, offset down and right so both read as cards. */
const FRONT_CARD: Box = { x: 218, y: 170, w: 148, h: 118 };
/** The pocket: straight-ish top, deep rounded bottom. */
const POCKET: Box = { x: 128, y: 240, w: 256, h: 196 };
/** The rim, drawn as a bar of ground colour so it cuts card from pocket. */
const RIM: Box = { x: 128, y: 234, w: 256, h: 12 };

const CARD_RADIUS = 22;
const POCKET_TOP_RADIUS = 26;
const POCKET_BOTTOM_RADIUS = 90;
const TILE_RADIUS = 118;

export function PocketMark({
  size = 64,
  className,
  label,
}: {
  /** Edge length in pixels. */
  size?: number;
  className?: string;
  /**
   * Accessible name. Omit for decorative use — the mark is then hidden from
   * assistive technology, which is right next to a "Pocket" heading.
   */
  label?: string;
}) {
  const u = size / GRID;
  const px = (n: number) => n * u;

  const box = (
    b: Box,
    background: string,
    radius: number | [number, number, number, number],
  ): CSSProperties => {
    const [tl, tr, br, bl] =
      typeof radius === "number" ? [radius, radius, radius, radius] : radius;
    return {
      position: "absolute",
      left: px(b.x),
      top: px(b.y),
      width: px(b.w),
      height: px(b.h),
      background,
      borderTopLeftRadius: px(tl),
      borderTopRightRadius: px(tr),
      borderBottomRightRadius: px(br),
      borderBottomLeftRadius: px(bl),
    };
  };

  return (
    <div
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        position: "relative",
        display: "flex",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: px(TILE_RADIUS),
        background: brand.mark.ground,
      }}
    >
      <div style={box(BACK_CARD, brand.mark.highlight, CARD_RADIUS)} />
      <div style={box(FRONT_CARD, brand.mark.ink, CARD_RADIUS)} />
      <div
        style={box(POCKET, brand.mark.ink, [
          POCKET_TOP_RADIUS,
          POCKET_TOP_RADIUS,
          POCKET_BOTTOM_RADIUS,
          POCKET_BOTTOM_RADIUS,
        ])}
      />
      <div style={box(RIM, brand.mark.ground, 0)} />
    </div>
  );
}
