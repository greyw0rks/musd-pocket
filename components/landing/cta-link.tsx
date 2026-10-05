import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The primary conversion action. Mezo orange in both themes — on the marketing
 * surface the orange *is* the brand thread (brief §6), so it deliberately does
 * not follow the app's themed `primary`.
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
        "inline-flex items-center justify-center gap-2 rounded-lg bg-mezo font-semibold text-white shadow-sm transition-colors",
        "hover:bg-mezo-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mezo/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        size === "lg" ? "px-7 py-4 text-base" : "px-5 py-3 text-[15px]",
        className,
      )}
    >
      {children}
    </Link>
  );
}
