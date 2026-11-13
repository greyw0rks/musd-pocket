"use client";

import { useState } from "react";
import { Check, Circle, Share2, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";
import { WEEKLY_TASKS, type WeeklyStatus } from "@/lib/rewards/weekly";
import { Button } from "@/components/pocket/ui/Button";

export function WeeklyTasks() {
  const api = useApi();
  const { user, walletAddress } = useSession();
  const [shared, setShared] = useState(false);
  const [shareError, setShareError] = useState(false);
  const query = useQuery({
    queryKey: ["weekly-tasks", user?.id, walletAddress], enabled: Boolean(user),
    queryFn: () => api<WeeklyStatus>("/api/rewards/weekly"), staleTime: 30_000,
    refetchInterval: 60_000, retry: false,
  });
  const tasks = query.data?.tasks;
  const completed = tasks?.filter(task => task.complete).length ?? 0;
  const resets = query.data?.resetsAt ? new Date(query.data.resetsAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : null;
  async function invite() {
    if (!query.data) return;
    setShareError(false);
    try {
      if (navigator.share) await navigator.share({ title: "Join me on Pocket", text: "Send and receive mUSD with Pocket.", url: query.data.inviteUrl });
      else await navigator.clipboard.writeText(query.data.inviteUrl);
      setShared(true);
    } catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setShareError(true); }
  }
  return <section className="mt-7 border-t border-[var(--line)] pt-5" aria-label="Weekly tasks">
    <div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold">This week&apos;s tasks</h3><span className="pk-m text-xs">{tasks ? `${completed}/${tasks.length}` : "Checking…"}</span></div>
    <p className="pk-m mt-2 text-xs leading-relaxed">{resets ? `Refreshes ${resets}.` : "A fresh checklist every Monday."} Progress updates automatically from confirmed activity.</p>
    {query.isError ? <p role="alert" className="mt-3 text-xs text-[var(--rd)]">Could not load your tasks. Try refreshing.</p> : query.data?.syncing ? <p role="status" className="pk-m mt-3 text-xs">Some activity is still syncing. Confirmed progress is kept.</p> : null}
    <div className="mt-4 space-y-2">
      {WEEKLY_TASKS.map(task => {
        const progress = tasks?.find(item => item.id === task.id);
        return <div key={task.id} className="flex gap-3 rounded-2xl bg-[var(--s2)] p-3">
          <span role="checkbox" aria-checked={progress?.complete ?? false} aria-readonly="true" aria-label={task.title} className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${progress?.complete ? "bg-[var(--p)] text-white" : "text-[var(--m)]"}`}>{progress?.complete ? <Check size={15} /> : <Circle size={21} />}</span>
          <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold">{task.title}</p><p className="pk-m mt-1 text-[11px] leading-relaxed">{task.detail}</p></div>
          <span className="pk-m shrink-0 pt-1 text-xs" aria-label={`${task.title} progress`}>{progress ? `${progress.progress}/${task.target}` : "—"}</span>
        </div>;
      })}
    </div>
    <Button full className="mt-4" disabled={!query.data} icon={<Share2 size={16} />} onClick={() => void invite()}>{shared ? "Invite link shared" : "Invite friends"}</Button>
    {shareError && query.data ? <p className="pk-m mt-2 break-all text-xs select-all" role="status">Copy your invite link: {query.data.inviteUrl}</p> : null}
    <Button full variant="ghost" className="mt-1" disabled={query.isFetching} icon={<RefreshCw size={14} />} onClick={() => void query.refetch()}>{query.isFetching ? "Checking activity…" : "Refresh progress"}</Button>
  </section>;
}
