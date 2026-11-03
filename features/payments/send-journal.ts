import type { Hash } from "viem";
import type { Recipient, Transaction } from "./payment.types";

export type JournalEntry = {
  hash: Hash;
  sender: string;
  recipient: Recipient;
  amount: string;
  createdAt: string;
  requestKey?: string;
  status: Transaction["status"];
  error?: string;
};

/** One storage item per hash avoids two tabs overwriting a shared array. */
export function createSendJournal(
  chainId: number,
  getStorage: () => Storage = () => window.localStorage,
) {
  const memory = new Map<string, JournalEntry>();
  const prefix = (sender: string) =>
    `pocket:direct:${chainId}:${sender.toLowerCase()}:`;
  const key = (entry: JournalEntry) =>
    prefix(entry.sender) + entry.hash.toLowerCase();

  function list(sender: string): JournalEntry[] {
    const start = prefix(sender);
    try {
      const storage = getStorage();
      for (let i = 0; i < storage.length; i++) {
        const name = storage.key(i);
        if (!name?.startsWith(start)) continue;
        try {
          const value = JSON.parse(
            storage.getItem(name) ?? "null",
          ) as JournalEntry;
          if (
            value &&
            /^0x[\da-f]{64}$/i.test(value.hash) &&
            /^0x[\da-f]{40}$/i.test(value.recipient?.address ?? "") &&
            value.sender?.toLowerCase() === sender.toLowerCase() &&
            name === key(value) &&
            /^(?:0|[1-9]\d{0,19})(?:\.\d{1,2})?$/.test(value.amount) &&
            /[1-9]/.test(value.amount) &&
            Number.isFinite(Date.parse(value.createdAt)) &&
            ["pending", "confirmed", "failed"].includes(value.status)
          ) {
            memory.set(name, value);
          }
        } catch {
          /* Ignore malformed entries; never use them to sign. */
        }
      }
    } catch {
      /* Keep hashes captured in this tab if storage becomes unavailable. */
    }
    return [...memory.entries()]
      .filter(([name]) => name.startsWith(start))
      .map(([, value]) => value);
  }
  return {
    list,
    assertWritable() {
      const storage = getStorage();
      const probe = `pocket:direct:storage-check:${crypto.randomUUID()}`;
      storage.setItem(probe, "1");
      storage.removeItem(probe);
    },
    put(entry: JournalEntry) {
      memory.set(key(entry), entry);
      try {
        getStorage().setItem(key(entry), JSON.stringify(entry));
      } catch {
        /* The hash remains in memory and Activity. */
      }
    },
    remove(entry: JournalEntry) {
      memory.delete(key(entry));
      try {
        getStorage().removeItem(key(entry));
      } catch {
        /* A stored retry is idempotent. */
      }
    },
  };
}
