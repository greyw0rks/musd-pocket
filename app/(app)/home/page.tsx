"use client";

import { useRef, useState } from "react";
import { PocketApp } from "@/components/pocket/PocketApp";
import type { PocketServices } from "@/components/pocket/store";
import { createApiContactService } from "@/features/contacts/api-contact.adapter";
import { createApiPaymentService } from "@/features/payments/api-payment.adapter";
import { createApiRequestService } from "@/features/requests/api-request.adapter";
import {
  createApiSessionService,
  sessionFromUser,
} from "@/features/session/api-session.adapter";
import { useApi } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";

/**
 * Pocket, for real.
 *
 * The whole difference between this and `/app` is the `services` prop: the
 * same screens, the same shell, the same store — reading and writing the live
 * backend instead of fixtures. Nothing below this page knows which it is,
 * which is the point of the adapter boundary and also the risk, so the
 * dishonest option is called out rather than left implicit:
 *
 *   - `notifications` is an **empty array**, not the demo fixture. There is no
 *     notification backend, so the screen shows its empty state. Seeding
 *     invented notices into the real app would be a fabricated record of things
 *     that did not happen.
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

  /*
    The services are built once, for the lifetime of the mount, so anything
    they close over is frozen at that moment. The wallet address is not — Privy
    can mint it after this page mounts — so it is read through a ref that every
    render refreshes. Reading the variable directly would pin the first
    render's value, which is `null` for a user whose wallet has not landed yet.
  */
  const walletRef = useRef<string | null>(walletAddress);
  walletRef.current = walletAddress;

  const [services] = useState<PocketServices>(() => {
    const payments = createApiPaymentService({ fetchAuthed });
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
      notifications: [],
      // `user` is guaranteed by AuthGate; the fallback exists so a race during
      // the gate's own transition cannot throw inside a component.
      initialSession: user ? sessionFromUser(user, walletAddress) : null,
    };
  });

  return <PocketApp services={services} />;
}
