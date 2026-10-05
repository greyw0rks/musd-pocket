import type { SerializedRequest } from "@/lib/requests/serialize";

export type ContactRow = {
  id: string;
  ownerAddress: string;
  contactAddress: string;
  label: string;
  createdAt: string;
  updatedAt: string;
};

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `Request failed (${res.status})`,
    );
  }
  return data as T;
}

export const api = {
  createRequest: (body: {
    creatorAddress: string;
    recipientAddress: string;
    amount: string;
    description?: string | null;
    expiry: "never" | "24h" | "7d";
  }) =>
    fetch("/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then(json<SerializedRequest>),

  listRequests: (creator: string, status?: string) =>
    fetch(
      `/api/requests?creator=${creator}${status ? `&status=${status}` : ""}`,
    ).then(json<SerializedRequest[]>),

  getRequest: (shortId: string) =>
    fetch(`/api/requests/${shortId}`).then(json<SerializedRequest>),

  payRequest: (shortId: string, txHash: string) =>
    fetch(`/api/requests/${shortId}/pay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ txHash }),
    }).then(json<SerializedRequest & { pending?: boolean }>),

  listContacts: (owner: string) =>
    fetch(`/api/contacts?owner=${owner}`).then(json<ContactRow[]>),

  createContact: (body: {
    ownerAddress: string;
    contactAddress: string;
    label: string;
  }) =>
    fetch("/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then(json<ContactRow>),

  updateContact: (id: string, label: string) =>
    fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label }),
    }).then(json<ContactRow>),

  deleteContact: (id: string) =>
    fetch(`/api/contacts/${id}`, { method: "DELETE" }).then(
      json<{ ok: boolean }>,
    ),
};
