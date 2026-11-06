import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { greylabsPieces, MerchArt } from "@/components/merchants/GreylabsCatalog";
import { greylabsAccess } from "@/lib/merchants/access";

export const metadata: Metadata = { title: "Greylabs merch · Pocket", description: "Builder merch from Greylabs. Bring your Pocket discount code." };
export const dynamic = "force-dynamic";

export default async function GreylabsMerch({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const coupon = code && /^GREY-[A-F0-9]{16}$/.test(code)
    ? await prisma.merchantCoupon.findUnique({ where: { code }, select: { percent: true, code: true, merchant: true, userId: true } }) : null;
  const valid = coupon?.merchant === "greylabs" && (await greylabsAccess(coupon.userId)).eligible ? coupon : null;
  return <main className="min-h-dvh bg-[#f4f3ed] px-5 py-8 text-[#303529] sm:px-10">
    <div className="mx-auto max-w-4xl">
      <nav className="flex items-center justify-between text-sm"><Link href="/home" className="font-semibold">← Pocket</Link><span className="font-semibold">Greylabs</span></nav>
      <div className="py-12 sm:py-16"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]"><BadgeCheck size={16} />A Pocket merchant</p><h1 className="mt-5 text-5xl font-semibold tracking-tight sm:text-7xl">Greylabs<br />for builders.</h1><p className="mt-5 max-w-md text-sm leading-relaxed text-[#626656]">Pick a piece and ask the studio about sizes, availability and delivery. Bring your Pocket code for a little extra off.</p></div>
      {valid ? <div className="mb-8 rounded-2xl bg-[#303529] p-5 text-[#f4f3ed]"><p className="text-xl font-semibold">Your {valid.percent}% merch discount</p><p className="mt-2 break-all font-mono text-sm select-all">{valid.code}</p><p className="mt-2 text-xs text-[#c4c5aa]">Included in your request below. Greylabs confirms your price and order before you pay.</p></div> : <div className="mb-8 rounded-2xl border border-[#d6d8cb] p-5"><p className="font-semibold">Pocket members get 10–30% off.</p><Link href="/home" className="mt-2 inline-block text-sm underline">Get your code in Pocket → Send → Verified merchants</Link></div>}
      <div className="grid gap-5 sm:grid-cols-3">{greylabsPieces.map(piece => {
        const body = `Hi Greylabs,\n\nI'd like to ask about the ${piece.name}: sizes, availability, price and delivery.\n${valid ? `\nMy Pocket discount code: ${valid.code} (${valid.percent}% off).\n` : ""}\nThank you!`;
        return <article key={piece.type} className="overflow-hidden rounded-3xl border border-[#d6d8cb] bg-white/40"><div className="bg-[#e7e8dd] p-5"><MerchArt type={piece.type} /></div><div className="p-5"><h2 className="font-semibold">{piece.name}</h2><p className="mt-2 min-h-10 text-xs leading-relaxed text-[#626656]">{piece.detail}</p><a href={`mailto:davidehoda@yahoo.com?subject=${encodeURIComponent(`Greylabs merch enquiry: ${piece.name}`)}&body=${encodeURIComponent(body)}`} className="mt-5 flex items-center justify-between rounded-full bg-[#303529] px-4 py-3 text-xs font-semibold text-white">Ask about this piece<ArrowUpRight size={15} /></a></div></article>;
      })}</div>
      <p className="mt-8 text-xs leading-relaxed text-[#626656]">Design previews. Availability, final prices and delivery are confirmed by the studio.</p>
    </div>
  </main>;
}
