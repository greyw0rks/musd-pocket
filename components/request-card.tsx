import Link from "next/link";
import type { SerializedRequest } from "@/lib/requests/serialize";
import { StatusBadge } from "@/components/ui/status-badge";
import { relativeTime, formatAmount } from "@/lib/utils";
import { MUSD_SYMBOL } from "@/lib/mezo/config";

export function RequestCard({
  request,
  label,
}: {
  request: SerializedRequest;
  label?: string;
}) {
  return (
    <Link
      href={`/request/${request.shortId}`}
      className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-primary/40"
    >
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium text-foreground">
          {request.description || label || request.displayId}
        </p>
        <div className="mt-1.5">
          <StatusBadge status={request.status} />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="tabular text-[15px] font-semibold text-foreground">
          {formatAmount(request.amount)}{" "}
          <span className="text-[13px] font-normal text-muted">
            {MUSD_SYMBOL}
          </span>
        </p>
        <p className="mt-1 text-[12px] text-muted">
          {request.status === "PAID" && request.paidAt
            ? relativeTime(request.paidAt)
            : relativeTime(request.createdAt)}
        </p>
      </div>
    </Link>
  );
}
