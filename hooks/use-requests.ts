"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { api } from "@/lib/api";

export function useMyRequests(status?: string) {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["requests", address?.toLowerCase(), status ?? "all"],
    queryFn: () => api.listRequests(address!, status),
    enabled: Boolean(address),
    refetchInterval: 12_000,
  });
}

export function useRequest(shortId: string, poll = false) {
  return useQuery({
    queryKey: ["request", shortId],
    queryFn: () => api.getRequest(shortId),
    refetchInterval: poll ? 5_000 : false,
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
}

export function usePayRequest(shortId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (txHash: string) => api.payRequest(shortId, txHash),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request", shortId] });
      qc.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}
