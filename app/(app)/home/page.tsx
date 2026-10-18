"use client";

import { useRef, useState } from "react";
import { useWalletClient } from "wagmi";
import type { WalletClient } from "viem";
import { PocketApp } from "@/components/pocket/PocketApp";
import type { PocketServices } from "@/components/pocket/store";
import { createApiContactService } from "@/features/contacts/api-contact.adapter";
import { createChainPaymentService } from "@/features/payments/chain-payment.adapter";
import { createApiRequestService } from "@/features/requests/api-request.adapter";
import {
  createApiSessionService,
  sessionFromUser,
} from "@/features/session/api-session.adapter";
import { useApi } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";

/**
 * Pocket.
 *
 * The page builds one object — the services — and hands it to the app. Nothing
 * below this point knows where any of it comes from, which is the point of the
 * adapter boundary and also the risk, so the load-bearing choices are named
 * rather than left implicit:
 *
 *   - `payments` is the **chain** adapter, so a send is a transfer the user's
 *     own wallet signs rather than a ledger entry the server moves. This is the
 *     one line that decides where the money is, and it is here rather than
 *     buried in the store so there is one place to look.
 *   - Every service is required and every one of them is real. There is no
 *     notification backend, so the app starts with an empty notice list and
 *     shows its empty state — seeding invented notices would be a fabricated
 *     record of things that did not happen.
 *   - `initialSession` is built from the user the shell has already synced, so
 *     the first paint shows the real profile. Without it, a dropped request
 *     during boot would strand a signed-in user on the sign-in screen.
 *
 * The page is only reachable behind `AuthGate`, which renders nothing until
 * `/api/users/me` has answered — so in practice `user` is non-null by the time
 * this renders, and `initialSession` is therefore always the real profile.
 */
export default function HomePage() {
  const fetchAuthed = useApi();
  const { user, walletAddress, login, logout } = useSession();
  const { data: walletClient } = useWalletClient();

  /*
    The services are built once, for the lifetime of the mount, so anything
    they close over is frozen at that moment. Neither the wallet address nor the
    wallet client is — Privy can mint the wallet after this page mounts, and the
    client only appears once `EmbeddedWalletActivator` has made it the active
    wallet. Both are read through refs that every render refreshes; reading the
    variables directly would pin the first render's values, which are `null` for
    a user whose wallet has not landed yet. A send signed with a frozen `null`
    client could not happen at all.
  */
  const walletRef = useRef<string | null>(walletAddress);
  walletRef.current = walletAddress;

  const walletClientRef = useRef<WalletClient | null>(null);
  walletClientRef.current = (walletClient as WalletClient | undefined) ?? null;

  const [services] = useState<PocketServices>(() => {
    const payments = createChainPaymentService({
      fetchAuthed,
      getWalletClient: () => walletClientRef.current,
      getWalletAddress: () => walletRef.current,
    });
    return {
      payments,
      sessions: createApiSessionService({
        fetchAuthed,
        login,
        logout,
        getWalletAddress: () => walletRef.current,
      }),
      requests: createApiRequestService({ fetchAuthed, payments }),
      contacts: createApiContactService(fetchAuthed),
      // `user` is guaranteed by AuthGate; the fallback exists so a race during
      // the gate's own transition cannot throw inside a component.
      initialSession: user ? sessionFromUser(user, walletAddress) : null,
    };
  });

  return <PocketApp services={services} />;
}
