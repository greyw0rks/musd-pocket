/* eslint-disable @next/next/no-img-element */
"use client";

import { avatarTone, initials } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/**
 * A person's picture.
 *
 * The coloured disc underneath is not decoration: portraits are hot-linked,
 * so a blocked or slow image degrades to a coloured circle with the person's
 * initials rather than a broken box. The layout never depends on the network.
 *
 * Size is a number rather than a class so the initials — which are sized in
 * `em` — scale with the disc instead of the container's inherited font size.
 */
export function Avatar({
  name,
  src,
  size = 40,
  className,
  imgClassName,
}: {
  name: string;
  src?: string;
  size?: number;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        avatarTone(name),
        className,
      )}
    >
      <span aria-hidden="true" className="absolute font-bold">
        {initials(name)}
      </span>
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn("relative size-full object-cover", imgClassName)}
        />
      ) : null}
    </span>
  );
}
