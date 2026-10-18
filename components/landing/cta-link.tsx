import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The primary conversion action.
 *
 * This is the app's `.pk-btn`: a full-radius pill in the inverse pair — black
 * on the light theme, white on the dark one. It was Mezo orange, which made the
 * marketing page and the product disagree about what a primary action looks
 * like; adopting the brand kit means the biggest button on the site is the same
 * button the wallet uses.
 *
 * Purple stays an accent (see `Eyebrow`, icon chips, data), never the action.
 */
export function CtaLink({
  href,
  children,
  className,
  size = "md",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-foreground font-semibold text-background transition-opacity",
        "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        size === "lg" ? "px-7 py-3.5 text-base" : "px-6 py-3 text-[15px]",
        className,
      )}
    >
      {children}
    </Link>
  );
}
