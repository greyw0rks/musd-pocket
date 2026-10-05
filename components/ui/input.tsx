import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-[15px] text-foreground",
      "placeholder:text-muted/70 outline-none transition-colors",
      "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
      "disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-[13px] font-medium text-muted mb-1.5 block",
        className,
      )}
      {...props}
    />
  );
}
