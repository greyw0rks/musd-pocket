"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Receipt,
  Wallet,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/wordmark";
import { UserMenu } from "@/components/user-menu";

type NavItem = { href: string; label: string; icon: LucideIcon };

// The four pillars. "Pay" is the prominent center action, handled separately.
const primaryNav: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/activity", label: "Activity", icon: Receipt },
  { href: "/wallet", label: "Wallet", icon: Wallet },
];

const PAY_HREF = "/pay";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const desktopNav: NavItem[] = [
    primaryNav[0],
    { href: PAY_HREF, label: "Pay", icon: ArrowUpRight },
    ...primaryNav.slice(1),
  ];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
        <Link href="/home" className="px-2">
          <Wordmark className="text-lg" />
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {desktopNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <Link
          href={PAY_HREF}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-dark"
        >
          <ArrowUpRight className="size-4" />
          Send MUSD
        </Link>
        <div className="mt-auto pt-6">
          <UserMenu />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:hidden">
          <Link href="/home">
            <Wordmark />
          </Link>
          <UserMenu compact />
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-10 md:pt-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav with raised center Pay action */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 items-end">
          <BottomTab item={primaryNav[0]} active={isActive(primaryNav[0].href)} />
          <BottomTab item={primaryNav[1]} active={isActive(primaryNav[1].href)} />
          <div className="flex justify-center">
            <Link
              href={PAY_HREF}
              aria-label="Pay"
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:bg-primary-dark"
            >
              <ArrowUpRight className="size-6" />
            </Link>
          </div>
          <BottomTab item={primaryNav[2]} active={isActive(primaryNav[2].href)} />
        </div>
      </nav>
    </div>
  );
}

function BottomTab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
        active ? "text-primary" : "text-muted",
      )}
    >
      <Icon className="size-5" />
      {item.label}
    </Link>
  );
}
