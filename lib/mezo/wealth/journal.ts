import { isAddress, type Address, type Hex } from "viem";
import { CHAIN_ID } from "../config";
import type { WealthCall } from "./types";

export type PendingWealth = {
  requestId: string;
  owner: Address;
  chainId: number;
  hash: Hex | null;
  kind: "approval" | "action";
  title: string;
  call: WealthCall;
};
const memory = new Map<string, PendingWealth>();
const memoryOnly = new Set<string>();
const key = (owner: string) =>
  `pocket:wealth:v1:${CHAIN_ID}:${owner.toLowerCase()}`;
export function readPendingWealth(owner: Address): PendingWealth | null {
  const id = key(owner);
  try {
    const raw = localStorage.getItem(id);
    if (!raw && !memoryOnly.has(id)) {
      memory.delete(id); // A different tab may have confirmed and cleared it.
      return null;
    }
    if (raw) {
      const value = JSON.parse(raw);
      if (
        typeof value.requestId === "string" &&
        value.chainId === CHAIN_ID &&
        value.owner?.toLowerCase() === owner.toLowerCase() &&
        (value.hash === null || /^0x[\da-f]{64}$/i.test(value.hash)) &&
        ["approval", "action"].includes(value.kind) &&
        typeof value.title === "string" &&
        isAddress(value.call?.to) &&
        /^0x(?:[\da-f]{2})*$/i.test(value.call?.data) &&
        /^\d+$/.test(value.call?.value)
      ) {
        return {
          ...value,
          call: { ...value.call, value: BigInt(value.call.value) },
        };
      }
    }
  } catch {
    /* Keep the in-memory copy if storage is unavailable. */
  }
  return memory.get(id) ?? null;
}
export function storePendingWealth(value: PendingWealth) {
  memory.set(key(value.owner), value);
  try {
    localStorage.setItem(
      key(value.owner),
      JSON.stringify(value, (_, item) =>
        typeof item === "bigint" ? item.toString() : item,
      ),
    );
    memoryOnly.delete(key(value.owner));
  } catch {
    memoryOnly.add(key(value.owner));
    /* Memory retains the hash for this page. */
  }
}
export function clearPendingWealth(owner: Address, expected?: PendingWealth) {
  if (expected) {
    const current = readPendingWealth(owner);
    if (
      current?.requestId !== expected.requestId ||
      current?.hash !== expected.hash
    )
      return false;
  }
  memory.delete(key(owner));
  memoryOnly.delete(key(owner));
  try {
    localStorage.removeItem(key(owner));
  } catch {
    /* Storage may be disabled. */
  }
  return true;
}
