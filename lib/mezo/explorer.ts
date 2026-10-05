import { EXPLORER_URL } from "./config";

/** Build Mezo explorer links. Base URL follows the active env (testnet/mainnet). */
export const explorer = {
  tx: (hash: string) => `${EXPLORER_URL}/tx/${hash}`,
  address: (address: string) => `${EXPLORER_URL}/address/${address}`,
  token: (address: string) => `${EXPLORER_URL}/token/${address}`,
  base: EXPLORER_URL,
};
