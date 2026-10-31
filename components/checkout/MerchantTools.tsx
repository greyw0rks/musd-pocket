"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/pocket/PhoneShell";
import { Button } from "@/components/pocket/ui/Button";
import { TextField, TextArea } from "@/components/pocket/ui/TextField";
import { QrCode } from "@/components/pocket/ui/QrCode";
import { useApi } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";
import type { SerializedRequest } from "@/lib/requests/serialize";
import { explorer } from "@/lib/mezo/explorer";
const subscribeOrigin = () => () => {};

export function MerchantTools() {
  const api = useApi();
  const session = useSession();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expiry, setExpiry] = useState("24h");
  const [selected, setSelected] = useState<SerializedRequest | null>(null);
  const origin = useSyncExternalStore(subscribeOrigin, () => window.location.origin, () => "");
  const [message, setMessage] = useState<string | null>(null);
  const profile = useQuery({ queryKey: ["merchant-profile", session.walletAddress], queryFn: () => api<{ businessName: string | null; walletAddress: string }>("/api/merchant/profile") });
  const invoices = useQuery({ queryKey: ["merchant-invoices", session.walletAddress], queryFn: () => api<SerializedRequest[]>("/api/merchant/invoices"), refetchInterval: 10_000 });
  const save = useMutation({ mutationFn: () => api("/api/merchant/profile", { method: "POST", body: JSON.stringify({ businessName: name }) }), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["merchant-profile"] }); await session.refresh(); setMessage("Business name saved."); } });
  const create = useMutation({ mutationFn: () => api<SerializedRequest>("/api/merchant/invoices", { method: "POST", body: JSON.stringify({ amount, description, expiry }) }), onSuccess: async row => { setSelected(row); setAmount(""); setDescription(""); setMessage(null); await qc.invalidateQueries({ queryKey: ["merchant-invoices"] }); } });
  const current = invoices.data?.find(row => row.shortId === selected?.shortId) ?? selected;
  const url = current && origin ? `${origin}/pay/${current.shortId}` : "";
  const error = save.error || create.error || profile.error || invoices.error;
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: `Pay ${current?.merchantName}`, url });
      else { await navigator.clipboard.writeText(url); setMessage("Payment link copied."); }
    } catch (error) { if ((error as Error).name !== "AbortError") setMessage("Could not share. Copy the payment link below."); }
  }
  return <AppShell screen="merchant"><main className="pk-scr flex flex-1 flex-col overflow-y-auto px-6 py-6">
    <Link href="/home" className="pk-m mb-8 w-fit">← Pocket</Link>
    <p className="pk-m uppercase">For merchants</p><h1 className="pk-h1 mt-2">Get paid in mUSD</h1>
    <p className="pk-m mt-3">Create a payment link or QR. Customer payments arrive directly in your Pocket wallet.</p>
    <div className="pk-card mt-6 space-y-3">
      <TextField label="Business name" value={name} placeholder={profile.data?.businessName || "Your business name"} maxLength={80} onChange={event => setName(event.target.value)} />
      <Button full variant="secondary" loading={save.isPending} disabled={name.trim().length < 2} onClick={() => save.mutate()}>Save business name</Button>
      {profile.data?.businessName ? <p className="pk-m">Checkout name: {profile.data.businessName}</p> : null}
    </div>
    <div className="pk-card space-y-3">
      <h2 className="pk-h2">New invoice</h2>
      <TextField label="Amount in mUSD" value={amount} inputMode="decimal" placeholder="25.00" onChange={event => setAmount(event.target.value)} />
      <TextArea label="For" rows={2} value={description} maxLength={120} placeholder="Order or service" onChange={event => setDescription(event.target.value)} />
      <label className="pk-m block">Expires<select value={expiry} onChange={event => setExpiry(event.target.value)} className="mt-2 block w-full rounded-xl bg-[var(--s2)] p-3 text-[var(--t)]"><option value="24h">In 24 hours</option><option value="7d">In seven days</option></select></label>
      <Button full loading={create.isPending} disabled={!profile.data?.businessName || !amount} onClick={() => create.mutate()}>Create payment link</Button>
      <p className="pk-m">Pilot checkout has no Pocket service fee. Customers pay the BTC network fee.</p>
    </div>
    {error ? <p role="alert" className="pk-m mt-3">{error.message}</p> : null}
    {message ? <p role="status" className="pk-m mt-3">{message}</p> : null}
    {current && url ? <section className="pk-card mt-4 text-center"><h2 className="pk-h2">{current.amount} mUSD</h2><p className="pk-m mt-2">{current.description}</p><div className="my-4 flex justify-center"><QrCode value={url} label="Scan to pay this invoice in Pocket" /></div><a className="pk-m break-all underline" href={url}>{url}</a><Button full className="mt-4" variant="secondary" onClick={() => void share()}>Share payment link</Button><p role="status" className="pk-m mt-3">{current.status === "PAID" ? "Payment received" : current.status === "LATE_PAID" ? "Payment received after expiry" : current.status.toLowerCase()}</p>{current.txHash ? <a className="pk-m mt-2 inline-block underline" href={explorer.tx(current.txHash)} target="_blank" rel="noreferrer">View transaction</a> : null}</section> : null}
    <section className="mt-6"><h2 className="pk-h2">Your invoices</h2>{invoices.isLoading ? <p className="pk-m mt-3">Loading invoices…</p> : invoices.data?.length ? invoices.data.map(row => <button key={row.shortId} type="button" onClick={() => setSelected(row)} className="pk-card pk-row pk-sp w-full text-left"><span className="min-w-0"><b>{row.amount} mUSD</b><span className="pk-m mt-1 block truncate">{row.description || "Payment request"}</span></span><span className="pk-m">{row.status.toLowerCase()}</span></button>) : <p className="pk-m mt-3">Create your first invoice to start accepting mUSD.</p>}</section>
  </main></AppShell>;
}
