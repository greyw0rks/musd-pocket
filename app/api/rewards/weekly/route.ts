import { requireIdentity, errorResponse, AuthError } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { weeklyStatus } from "@/lib/rewards/weekly-service";
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const identity = await requireIdentity(req);
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) throw new AuthError("Sign in to view your weekly tasks.", 404);
    return Response.json(await weeklyStatus(user.id, identity.walletAddress), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
