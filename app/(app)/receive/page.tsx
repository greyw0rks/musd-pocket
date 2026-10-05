import { ArrowDownLeft } from "lucide-react";
import { PlaceholderScreen } from "@/components/placeholder-screen";

export default function ReceivePage() {
  return (
    <PlaceholderScreen
      icon={ArrowDownLeft}
      title="Receive MUSD"
      description="Share your @username, a QR code, or a payment link to get paid. Request-amount links arrive in a later phase."
    />
  );
}
