import { requireIdentity, errorResponse, AuthError, HttpError } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { merchantProfileSchema } from "@/lib/requests/schema";
import { prisma } from "@/lib/db";
export async function GET(req: Request) {
  try {
    const user = await getUserByWallet((await requireIdentity(req)).walletAddress);
    if (!user) throw new AuthError("Sync your Pocket account first.", 404);
    return Response.json({ businessName: user.businessName, walletAddress: user.walletAddress });
  } catch (error) { return errorResponse(error); }
}
export async function POST(req: Request) {
  try {
    const user = await getUserByWallet((await requireIdentity(req)).walletAddress);
    if (!user) throw new AuthError("Sync your Pocket account first.", 404);
    const input = merchantProfileSchema.safeParse(await req.json().catch(() => null));
    if (!input.success) throw new HttpError("Enter a business name between 2 and 80 characters.");
    const updated = await prisma.user.update({ where: { id: user.id }, data: { businessName: input.data.businessName, role: "MERCHANT" } });
    return Response.json({ businessName: updated.businessName, walletAddress: updated.walletAddress });
  } catch (error) { return errorResponse(error); }
}
