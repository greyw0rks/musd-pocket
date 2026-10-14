import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/components/pocket/pocket.css";

export const metadata: Metadata = {
  title: "Pocket — Interactive demo",
  description:
    "A four-screen walkthrough of sending MUSD to another person. Every figure in it is invented and no money moves.",
  // A demo is not a landing page. It should be shareable by link without
  // competing with the real site in search results.
  robots: { index: false, follow: false },
};

export default function PocketDemoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
