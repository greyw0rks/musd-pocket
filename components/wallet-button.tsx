"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { getAddress } from "viem";
import { Wallet, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddressDisplay } from "@/components/address-display";
import { shortenAddress } from "@/lib/utils";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleConnect = () => {
    // Prefer an injected (browser extension) connector.
    const injected =
      connectors.find((c) => c.type === "injected") ?? connectors[0];
    if (injected) connect({ connector: injected });
  };

  if (!isConnected || !address) {
    return (
      <Button
        onClick={handleConnect}
        loading={isConnecting || isPending}
        size={compact ? "sm" : "md"}
      >
        <Wallet className="size-4" />
        Connect wallet
      </Button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
      >
        <span className="size-2 rounded-full bg-success" />
        <span className="font-mono text-[13px]">
          {shortenAddress(getAddress(address))}
        </span>
        <ChevronDown className="size-4 text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-border bg-surface p-3 shadow-lg">
          <p className="px-1 text-[13px] text-muted">Connected wallet</p>
          <div className="mt-1 px-1">
            <AddressDisplay address={address} chars={6} copy link />
          </div>
          <button
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-1 py-2 text-sm text-error hover:bg-error-soft"
          >
            <LogOut className="size-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
