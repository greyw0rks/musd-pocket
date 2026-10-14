"use client";

import { SearchIcon, XIcon } from "@/components/pocket/icons";

/**
 * A search pill.
 *
 * One component for every search field in the app, because they are the same
 * control with different copy and having two of them is how they drift apart.
 *
 * `aria-label` is separate from the placeholder rather than defaulting to it:
 * a placeholder is written to disappear the moment someone types, and a
 * screen-reader label should not.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  label = placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** Screen-reader name. Defaults to the placeholder when they agree. */
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[27px] bg-[var(--s)] px-4 py-3">
      <SearchIcon size={15} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        type="search"
        className="w-full bg-transparent text-[13px] font-medium text-[var(--t)] outline-none placeholder:text-[var(--m)] [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="text-[var(--m)] transition hover:text-[var(--t)]"
        >
          <XIcon size={15} />
        </button>
      ) : null}
    </div>
  );
}
