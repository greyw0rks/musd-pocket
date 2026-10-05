import { Receipt } from "lucide-react";
import { PlaceholderScreen } from "@/components/placeholder-screen";

export default function ActivityPage() {
  return (
    <PlaceholderScreen
      icon={Receipt}
      title="Activity"
      description="Every send, receive, deposit, and withdrawal — with the on-chain details one tap away. Your feed fills up as you move MUSD."
    />
  );
}
