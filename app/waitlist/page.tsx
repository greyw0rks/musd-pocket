import { redirect } from "next/navigation";

/**
 * The waitlist is retired: Pocket is open. This route was linked from the
 * landing page and from early launch posts, so it hands people straight to the
 * app rather than 404ing — `/home` is the only front door now.
 */
export default function WaitlistPage() {
  return redirect("/home");
}
