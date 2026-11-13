"use client";
import { ArrowUpRight } from "lucide-react";
import { greylabsPieces, MerchArt } from "@/components/merchants/GreylabsCatalog";
import type { GreylabsCoupon } from "@/lib/merchants/greylabs";
import { Button } from "@/components/pocket/ui/Button";

export function GreylabsMerch({ coupon, onBack }: { coupon: GreylabsCoupon; onBack: () => void }) {
  return <div>
    <Button variant="ghost" onClick={onBack}>← Your discount</Button>
    <p className="mt-3 text-sm font-semibold">{coupon.percent}% off · Greylabs for builders</p>
    <p className="pk-m mt-2 text-xs">Pick a piece and ask about sizes, availability and delivery. Your discount code is included in the enquiry.</p>
    <div className="mt-5 space-y-4">{greylabsPieces.map(piece => {
      const body = `Hi Greylabs,\n\nI'd like to ask about the ${piece.name}: sizes, availability, price and delivery.\n\nMy Pocket discount code: ${coupon.code} (${coupon.percent}% off).\n\nThank you!`;
      return <article className="pk-card overflow-hidden" key={piece.type}>
        <div className="bg-[var(--s2)] p-3"><MerchArt type={piece.type} /></div>
        <div className="p-4"><h3 className="font-semibold">{piece.name}</h3><p className="pk-m mt-2 text-xs">{piece.detail}</p>
          <a href={`mailto:davidehoda@yahoo.com?subject=${encodeURIComponent(`Greylabs merch enquiry: ${piece.name}`)}&body=${encodeURIComponent(body)}`} className="mt-4 flex min-h-11 items-center justify-between rounded-full bg-[var(--p)] px-4 py-3 text-xs font-semibold text-white">Ask about this piece<ArrowUpRight size={15} /></a>
        </div>
      </article>;
    })}</div>
    <p className="pk-m mt-4 text-xs">Design previews. The studio confirms final prices and delivery.</p>
  </div>;
}
