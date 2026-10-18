"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider as InjectedWagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { getConfig } from "@/lib/wallet/config";
import {
  PRIVY_APP_ID,
  hasPrivy,
  privyConfig,
  getPrivyWagmiConfig,
} from "@/lib/wallet/privy";
import { SessionProvider, NoAuthSessionProvider } from "@/lib/auth/session";
import { MfaGate } from "@/lib/wallet/mfa-gate";

function useQueryClient() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, refetchOnWindowFocus: false },
        },
      }),
  );
  return queryClient;
}

/** Privy-backed stack: embedded wallet (social login) is the everyday wallet. */
function PrivyProviders({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [wagmiConfig] = useState(() => getPrivyWagmiConfig());

  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
      {/*
        The passkey listener, and the reason it lives here rather than on a
        screen: `privyConfig` runs with `showWalletUIs: false`, so an MFA
        challenge can arrive from anywhere in the app — a send, a repay, an
        approval. It has to be answered from a component that is always
        mounted, and this is the only place inside `PrivyProvider` that is.
        It renders nothing; see lib/wallet/mfa-gate.tsx.
      */}
      <MfaGate />
      <QueryClientProvider client={queryClient}>
        <PrivyWagmiProvider config={wagmiConfig}>
          <SessionProvider>{children}</SessionProvider>
        </PrivyWagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

/** Fallback stack when NEXT_PUBLIC_PRIVY_APP_ID is unset: injected wallets only. */
function InjectedProviders({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [config] = useState(() => getConfig());

  return (
    <InjectedWagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <NoAuthSessionProvider>{children}</NoAuthSessionProvider>
      </QueryClientProvider>
    </InjectedWagmiProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return hasPrivy() ? (
    <PrivyProviders>{children}</PrivyProviders>
  ) : (
    <InjectedProviders>{children}</InjectedProviders>
  );
}
