import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 0x82…91A4 style truncation for addresses / tx hashes. */
export function shortenAddress(address?: string | null, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

/** Storage key: always lowercase. Display: use viem getAddress (checksummed). */
export function toStorageAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * Human relative time: "just now", "2h ago", "Yesterday", or a date.
 *
 * Past the hour mark the answer is counted in calendar days rather than in
 * elapsed hours, because that is what the day heading above it counts. Elapsed
 * hours put "26 hours ago" and "Yesterday" in the same bucket, which is right
 * at noon and wrong at half past midnight — 26 hours before 00:50 on the 13th
 * is the evening of the 11th, and calling that "Yesterday" contradicts a
 * heading that says otherwise. Below 24 hours the elapsed figure is both
 * accurate and more useful, so it stays.
 */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfThen = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
  ).getTime();
  const days = Math.round((startOfToday - startOfThen) / 86_400_000);

  if (days <= 0) {
    const hr = Math.floor(min / 60);
    return hr < 1 ? `${min}m ago` : `${hr}h ago`;
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * How long until something happens: "in 6d", "in 3h", "in 20m".
 *
 * The mirror of `relativeTime`, and deliberately a second function rather than
 * a flag on the first. `relativeTime` is past-only by construction — it counts
 * elapsed milliseconds, so a future timestamp floors to zero and comes back
 * "just now", which is how a request expiring next week ends up claiming it
 * expires immediately.
 *
 * Weeks are the ceiling: past seven days the exact day matters less than the
 * fact that it is not soon, and a request window is a week anyway.
 */
export function untilTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const min = Math.ceil((d.getTime() - Date.now()) / 60000);
  if (min <= 0) return "any moment now";
  if (min < 60) return `in ${min}m`;

  const hr = Math.round(min / 60);
  if (hr < 24) return `in ${hr}h`;

  const days = Math.round(hr / 24);
  return `in ${days}d`;
}

export function formatAmount(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
