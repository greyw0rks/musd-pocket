"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, useApi } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";
import type { WelcomeRewardStatus } from "@/lib/rewards/types";

export function useWelcomeReward(open: boolean) {
  const { user, walletAddress } = useSession();
  const api = useApi();
  const queryClient = useQueryClient();
  const queryKey = ["welcome-reward", user?.id, walletAddress];
  const identityKey = `${user?.id}:${walletAddress}`;
  const [pending, setPending] = useState<{ identity: string; hash: string } | null>(null);
  const pendingHash = pending?.identity === identityKey ? pending.hash : null;
  const query = useQuery({
    queryKey, enabled: open && Boolean(user),
    queryFn: () => api<WelcomeRewardStatus>(`/api/rewards/welcome${pendingHash ? `?txHash=${encodeURIComponent(pendingHash)}` : ""}`),
    staleTime: 15_000,
    refetchInterval: (q) => pendingHash && q.state.data?.state !== "claimed" && q.state.data?.pendingStatus !== "reverted" ? 3_000 : false,
    retry: (count, error) => !(error instanceof ApiError && [401, 404].includes(error.status)) && count < 1,
  });
  const mutation = useMutation({
    mutationKey: queryKey,
    mutationFn: () => api<WelcomeRewardStatus>("/api/rewards/welcome", { method: "POST" }),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKey, status);
      if (status.pendingTxHash) setPending({ identity: identityKey, hash: status.pendingTxHash });
    },
  });
  const error = mutation.error ?? query.error;
  return {
    data: query.data, loading: query.isPending, claiming: mutation.isPending,
    pendingTxHash: query.data?.state === "claimed" || query.data?.pendingStatus === "reverted" ? null : pendingHash,
    error: error instanceof Error ? error.message : null,
    refresh: () => { mutation.reset(); void query.refetch(); },
    claim: async () => { try { await mutation.mutateAsync(); } catch { /* shown in sheet */ } },
  };
}
