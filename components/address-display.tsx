"use client";

import { getAddress } from "viem";
import { ExternalLink } from "lucide-react";
import { shortenAddress, cn } from "@/lib/utils";
import { explorer } from "@/lib/mezo/explorer";
import { CopyButton } from "@/components/ui/copy-button";

function checksum(address: string) {
  try {
    return getAddress(address);
  } catch {
    return address;
  }
}

export function AddressDisplay({
  address,
  chars = 4,
  link = true,
  copy = false,
  className,
}: {
  address: string;
  chars?: number;
  link?: boolean;
  copy?: boolean;
  className?: string;
}) {
  const display = shortenAddress(checksum(address), chars);

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {link ? (
        <a
          href={explorer.address(address)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[13px] text-foreground hover:text-primary"
        >
          {display}
          <ExternalLink className="size-3 text-muted" />
        </a>
      ) : (
        <span className="font-mono text-[13px] text-foreground">{display}</span>
      )}
      {copy && <CopyButton value={checksum(address)} />}
    </span>
  );
}
