"use client";

import { CHAIN_ID } from "@/lib/mezo/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, useApi } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";
import type { WelcomeRewardStatus } from "@/lib/rewards/types";

export function useWelcomeReward(open: boolean) {
  const { user, walletAddress } = useSession();
  const api = useApi();
  const queryClient = useQueryClient();
  const queryKey = ["welcome-reward", CHAIN_ID, user?.id, walletAddress];
  const storageKey = `pocket:welcome:${CHAIN_ID}:${user?.id}:${walletAddress?.toLowerCase()}`;
  function storedHash(): string | null {
    try {
      const hash = localStorage.getItem(storageKey);
      return hash && /^0x[0-9a-f]{64}$/i.test(hash) ? hash : null;
    } catch {
      return null;
    }
  }
  function remember(status: WelcomeRewardStatus) {
    try {
      if (status.state === "claimed" || status.pendingStatus === "reverted")
        localStorage.removeItem(storageKey);
      else if (status.pendingTxHash)
        localStorage.setItem(storageKey, status.pendingTxHash);
    } catch {
      /* The server journal remains the recovery source. */
    }
    return status;
  }
  const query = useQuery({
    queryKey,
    enabled: open && Boolean(user),
    queryFn: async () => {
      const hash = storedHash();
      const status = await api<WelcomeRewardStatus>(
        `/api/rewards/welcome${hash ? `?txHash=${encodeURIComponent(hash)}` : ""}`,
      );
      return remember(
        status.state === "unavailable" && hash
          ? { ...status, pendingTxHash: hash, pendingStatus: "pending" }
          : status,
      );
    },
    staleTime: 15_000,
    refetchInterval: (q) =>
      q.state.data?.pendingTxHash &&
      q.state.data?.state !== "claimed" &&
      q.state.data?.pendingStatus !== "reverted"
        ? 3_000
        : false,
    retry: (count, error) =>
      !(error instanceof ApiError && [401, 404].includes(error.status)) &&
      count < 1,
  });
  const mutation = useMutation({
    mutationKey: queryKey,
    mutationFn: () =>
      api<WelcomeRewardStatus>("/api/rewards/welcome", { method: "POST" }),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKey, status);
      remember(status);
    },
  });
  const error = mutation.error ?? query.error;
  return {
    data: query.data,
    loading: query.isPending,
    claiming: mutation.isPending,
    pendingTxHash:
      query.data?.state === "claimed" ||
      query.data?.pendingStatus === "reverted"
        ? null
        : (query.data?.pendingTxHash ?? null),
    error: error instanceof Error ? error.message : null,
    refresh: () => {
      mutation.reset();
      void query.refetch();
    },
    claim: async () => {
      try {
        await mutation.mutateAsync();
      } catch {
        /* shown in sheet */
      }
    },
  };
}
