import type { Metadata } from "next";
import "@/components/pocket/pocket.css";
import { BrandKit } from "@/components/brand/BrandKit";

/**
 * The brand kit reference.
 *
 * Open at `/brand`. It is a working page, not documentation: every sample is
 * the real component in the real stylesheet, so it is always a picture of the
 * app as it currently ships. Keep it open next to a new screen.
 */
export const metadata: Metadata = {
  title: "Pocket — Brand kit",
  description:
    "The tokens, type, shape and controls every Pocket screen is built from.",
};

export default function BrandPage() {
  return <BrandKit />;
}
