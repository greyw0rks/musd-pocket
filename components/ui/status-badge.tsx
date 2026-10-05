import { Clock, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type RequestStatusValue =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "EXPIRED";

const config: Record<
  RequestStatusValue,
  { label: string; icon: typeof Clock; className: string; spin?: boolean }
> = {
  PENDING: {
    label: "Waiting for payment",
    icon: Clock,
    className: "bg-warning-soft text-warning",
  },
  PROCESSING: {
    label: "Confirming payment",
    icon: Loader2,
    className: "bg-primary/10 text-primary",
    spin: true,
  },
  PAID: {
    label: "Paid",
    icon: Check,
    className: "bg-success-soft text-success",
  },
  EXPIRED: {
    label: "Expired",
    icon: X,
    className: "bg-error-soft text-error",
  },
};

export function StatusBadge({
  status,
  className,
  label,
}: {
  status: RequestStatusValue;
  className?: string;
  label?: string;
}) {
  const c = config[status];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium",
        c.className,
        className,
      )}
    >
      <Icon className={cn("size-3.5", c.spin && "animate-spin")} />
      {label ?? c.label}
    </span>
  );
}
