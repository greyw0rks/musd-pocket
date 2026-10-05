import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Flow } from "@/components/landing/flow";
import { Problem } from "@/components/landing/problem";
import { Features } from "@/components/landing/features";
import { SocialPayments } from "@/components/landing/social-payments";
import { Merchant } from "@/components/landing/merchant";
import { MezoSection } from "@/components/landing/mezo-section";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "Pocket — Spend your Bitcoin without selling it",
  description:
    "Use mUSD to send, request, and pay from one simple pocket. Bitcoin-backed spending on Mezo, without bridges, gas, or wallet addresses.",
  openGraph: {
    title: "Pocket — Spend your Bitcoin without selling it",
    description:
      "Use mUSD to send, request, and pay from one simple pocket. Bitcoin-backed spending on Mezo.",
    siteName: "Pocket",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pocket — Spend your Bitcoin without selling it",
    description:
      "Use mUSD to send, request, and pay from one simple pocket. Bitcoin-backed spending on Mezo.",
  },
};

/**
 * The marketing page. Every section is its own component so this file stays a
 * table of contents. Only Navbar, WalletMockup and the Reveal wrappers are
 * client components — the rest render to static HTML.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Flow />
        <Problem />
        <Features />
        <SocialPayments />
        <Merchant />
        <MezoSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
