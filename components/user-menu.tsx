"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { getAddress } from "viem";
import { Settings, LogOut, ChevronDown, User as UserIcon } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { shortenAddress } from "@/lib/utils";

/** Avatar + dropdown: identity, settings, log out. Settings/Profile live here. */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, walletAddress, logout } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;
  const initial = user.username.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-2.5 text-sm font-medium text-foreground hover:bg-background"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary">
          {initial}
        </span>
        {!compact && <span>@{user.username}</span>}
        <ChevronDown className="size-4 text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-border bg-surface p-2 shadow-lg">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-foreground">
              @{user.username}
            </p>
            {walletAddress && (
              <p className="technical mt-0.5 text-[12px] text-muted">
                {shortenAddress(getAddress(walletAddress), 6)}
              </p>
            )}
          </div>
          <div className="my-1 h-px bg-border" />
          <MenuLink href="/wallet" icon={UserIcon} label="Wallet" onNavigate={() => setOpen(false)} />
          <MenuLink href="/settings" icon={Settings} label="Settings" onNavigate={() => setOpen(false)} />
          <button
            onClick={() => {
              setOpen(false);
              void logout();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-error hover:bg-error-soft"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: typeof Settings;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-background"
    >
      <Icon className="size-4 text-muted" />
      {label}
    </Link>
  );
}
