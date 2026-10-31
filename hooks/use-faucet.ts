"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, useApi } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";
import type { FaucetStatusView } from "@/lib/faucet/types";
import { FAUCET_AMOUNTS, FAUCET_ROUND } from "@/lib/faucet/policy";

/**
 * The testnet faucet: one claim per account in the current round.
 *
 * `state` is what the header renders:
 *
 *  - `hidden` — signed out, mainnet, or the route says the faucet is off.
 *  - `available` — a claim is still owed. The faucet icon.
 *  - `claimed` — both legs have been broadcast. The rewards icon replaces it.
 *  - `loading` — the first read has not answered; the icon is drawn disabled
 *    rather than appearing a beat late and shifting the header.
 *
 * The claim is not a fire-and-forget mutation that then relies on a second
 * read: the POST returns the same status shape as the GET, so the icon flips
 * at the moment the server confirms both hashes exist.
 */
export type FaucetState = "hidden" | "loading" | "available" | "claimed";

export interface FaucetController {
  state: FaucetState;
  /** `null` while unknown — the claim endpoint is the authority either way. */
  funded: boolean | null;
  /** Broadcast, not yet confirmed by both receipts. */
  pending: boolean;
  claim: FaucetStatusView["claim"];
  amounts: { btc: string; musd: string };
  claiming: boolean;
  /** The claim failure, ready to render. Cleared on the next attempt. */
  error: string | null;
  claimFaucet: () => Promise<void>;
  clearError: () => void;
}

export function useFaucet(): FaucetController {
  const { user } = useSession();
  const api = useApi();
  const queryClient = useQueryClient();
  const queryKey = ["faucet", user?.id, FAUCET_ROUND];

  const query = useQuery<FaucetStatusView>({
    queryKey,
    enabled: Boolean(user),
    queryFn: () => api<FaucetStatusView>("/api/faucet"),
    staleTime: 30_000,
    retry: (count, error) => {
      // A rejected identity or a missing user row is terminal for this read.
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 404)
      ) {
        return false;
      }
      return count < 1;
    },
  });

  const mutation = useMutation({
    mutationFn: () =>
      api<FaucetStatusView>("/api/faucet", { method: "POST" }),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKey, status);
    },
  });

  const roundMismatch = Boolean(query.data && query.data.round !== FAUCET_ROUND);
  const data = roundMismatch ? undefined : query.data;
  const authError =
    query.error instanceof ApiError &&
    (query.error.status === 401 || query.error.status === 404);

  const state: FaucetState = !user
    ? "hidden"
    : roundMismatch
      ? "loading"
      : data?.enabled === false || authError
        ? "hidden"
        : data
          ? data.claimed
            ? "claimed"
            : "available"
          : // A transient read failure must not hide an available claim;
            // the sheet can retry through the POST.
            query.isError
            ? "available"
            : "loading";

  return {
    state,
    funded: data?.funded ?? null,
    pending: data?.pending ?? false,
    claim: data?.claim ?? null,
    amounts: data?.amounts ?? FAUCET_AMOUNTS,
    claiming: mutation.isPending,
    error: roundMismatch
      ? "The faucet update is being rolled out. Refresh shortly."
      : mutation.error
        ? mutation.error instanceof Error
          ? mutation.error.message
          : "The faucet could not send right now. Try again."
        : null,
    claimFaucet: async () => {
      // The failure is rendered from `mutation.error`; swallowing the rejection
      // here keeps a button click from becoming an unhandled promise.
      try {
        await mutation.mutateAsync();
      } catch {
        /* rendered above */
      }
    },
    clearError: () => mutation.reset(),
  };
}
