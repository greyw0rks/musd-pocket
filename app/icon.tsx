import { ImageResponse } from "next/og";
import { PocketMark } from "@/components/brand/pocket-mark";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/**
 * Browser tab icon: the Pocket mark.
 *
 * The mark itself lives in `components/brand/pocket-mark.tsx`, so the tab icon,
 * the installable icons and every in-app appearance are the same drawing. The
 * ground is the brand accent, not Mezo orange — the icon is the product's face
 * on a tab or a home screen, not an advertisement for the chain.
 */
export default function Icon() {
  return new ImageResponse(<PocketMark size={64} />, size);
}
