"use client";

import type { ReactNode } from "react";

import {
  ChevronRightIcon,
  LockIcon,
  VaultIcon,
  PoolIcon,
} from "@/components/pocket/icons";
import { SCREEN } from "@/components/pocket/theme";
import { PageHeading, ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { LocksPanel } from "./LocksPanel";
export { PoolsScreen } from "./PoolsScreen";

export function WealthScreen({
  onVault,
  onLocks,
  onPools,
}: {
  onVault: () => void;
  onLocks: () => void;
  onPools: () => void;
}) {
  return (
    <div className={SCREEN}>
      <PageHeading title="Wealth" />
      <p className="pk-m mt-1">
        Save mUSD, manage locks, and provide liquidity from Pocket.
      </p>
      <ListGroup className="mt-6">
        <WealthRow
          icon={<VaultIcon size={18} />}
          title="Vault"
          subtitle="Save mUSD and claim Savings yield"
          onPress={onVault}
        />
        <WealthRow
          icon={<LockIcon size={18} />}
          title="Lock"
          subtitle="Create, extend and withdraw your MEZO locks"
          onPress={onLocks}
        />
        <WealthRow
          icon={<PoolIcon size={18} />}
          title="Pools"
          subtitle="Add liquidity, remove it and claim pool fees"
          onPress={onPools}
        />
      </ListGroup>
    </div>
  );
}
function WealthRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <ListRow
      leading={<span className="pk-ico">{icon}</span>}
      title={title}
      subtitle={subtitle}
      trailing={<ChevronRightIcon size={18} />}
      onPress={onPress}
    />
  );
}

export function LockScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className={SCREEN}>
      <ScreenHeader
        title="Locks"
        subtitle="Your veMEZO positions"
        onBack={onBack}
      />
      <LocksPanel open />
    </div>
  );
}
