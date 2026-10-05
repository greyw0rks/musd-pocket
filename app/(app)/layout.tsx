import { Providers } from "@/app/providers";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <AuthGate>
        <AppShell>{children}</AppShell>
      </AuthGate>
    </Providers>
  );
}
