import { createConfig, http, cookieStorage, createStorage, injected } from "wagmi";
import { activeChain, RPC_URL, MEZO } from "@/lib/mezo/config";

/**
 * wagmi v3 config. Testnet-first: only the active Mezo chain is registered,
 * so wrong-network detection + switch target both resolve to it.
 *
 * Injected (browser extension) wallets only for MVP. To add WalletConnect/Reown
 * mobile pairing, install @wagmi/connectors and gate a walletConnect() connector
 * behind NEXT_PUBLIC_WC_PROJECT_ID.
 */
export function getConfig() {
  return createConfig({
    chains: [activeChain],
    connectors: [injected()],
    storage: createStorage({ storage: cookieStorage }),
    ssr: true,
    // activeChain's id is statically the union of both Mezo chain ids, so we
    // supply a transport for each; only the active one is ever used.
    transports: {
      [MEZO.mainnet.chainId]: http(
        activeChain.id === MEZO.mainnet.chainId ? RPC_URL : undefined,
      ),
      [MEZO.testnet.chainId]: http(
        activeChain.id === MEZO.testnet.chainId ? RPC_URL : undefined,
      ),
    },
  });
}
