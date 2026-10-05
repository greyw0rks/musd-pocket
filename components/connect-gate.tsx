"use client";

import { useAccount } from "wagmi";
import { Wallet } from "lucide-react";
import { WalletButton } from "@/components/wallet-button";
import { EmptyState } from "@/components/ui/empty-state";

/** Renders children only when a wallet is connected; otherwise a connect prompt. */
export function ConnectGate({
  children,
  title = "Connect your wallet",
  description = "Connect a Mezo wallet to continue.",
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const { isConnected } = useAccount();
  if (isConnected) return <>{children}</>;
  return (
    <EmptyState
      icon={Wallet}
      title={title}
      description={description}
      action={<WalletButton />}
    />
  );
}
