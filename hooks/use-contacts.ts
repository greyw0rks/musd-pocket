"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { api } from "@/lib/api";

export function useContacts() {
  const { address } = useAccount();
  const query = useQuery({
    queryKey: ["contacts", address?.toLowerCase()],
    queryFn: () => api.listContacts(address!),
    enabled: Boolean(address),
  });

  // Quick lookup: lowercase address -> label
  const byAddress = new Map(
    (query.data ?? []).map((c) => [c.contactAddress.toLowerCase(), c.label]),
  );

  return { ...query, byAddress };
}

export function useSaveContact() {
  const qc = useQueryClient();
  const { address } = useAccount();
  return useMutation({
    mutationFn: (input: { contactAddress: string; label: string }) =>
      api.createContact({ ownerAddress: address!, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      api.updateContact(id, label),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteContact(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}
