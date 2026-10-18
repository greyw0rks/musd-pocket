import { createElement } from "react";
import { ImageResponse } from "next/og";
import { PocketMark } from "@/components/brand/pocket-mark";

/**
 * The installable icon, generated rather than committed as a binary.
 *
 * The manifest needs real 192 and 512 PNGs to make the app installable; the
 * 64px `app/icon.tsx` is the browser-tab favicon and is too small for that.
 * Both render the same `PocketMark`, so the installed icon and the tab icon
 * cannot drift — and neither can drift from the mark shown inside the app.
 *
 * The ground is the brand accent rather than Mezo orange: the installed icon is
 * what a user looks at on their home screen, and it should name Pocket, not the
 * chain Pocket settles on.
 *
 * A `.ts` route rather than `.tsx` because Next's route-file convention is
 * `route.ts`; `createElement` keeps it JSX-free.
 */

export const dynamic = "force-static";

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: raw } = await context.params;
  const size = Number(raw);

  if (!Number.isFinite(size) || size < 32 || size > 1024) {
    return new Response("Unknown icon size", { status: 404 });
  }

  const mark = createElement(PocketMark, { size });

  return new ImageResponse(mark, { width: size, height: size });
}
