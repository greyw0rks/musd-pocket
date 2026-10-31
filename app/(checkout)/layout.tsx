import { Providers } from "@/app/providers";
import "@/components/pocket/pocket.css";
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
