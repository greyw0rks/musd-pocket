import type { LucideIcon } from "lucide-react";

/**
 * Phase-honest placeholder for screens wired into the nav but built in a later
 * phase (Pay/Deposit/Withdraw → Phase B, Activity/Receive → Phase C/D).
 */
export function PlaceholderScreen({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-7" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
    </div>
  );
}
