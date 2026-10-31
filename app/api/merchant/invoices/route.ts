import { requireIdentity, errorResponse, AuthError, HttpError } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { createInvoiceSchema, expiryToHours } from "@/lib/requests/schema";
import { createPaymentRequest, listByCreator } from "@/lib/requests/service";
import { serializeRequest } from "@/lib/requests/serialize";
export async function GET(req: Request) {
  try {
    const rows = await listByCreator((await requireIdentity(req)).walletAddress);
    return Response.json(rows.filter(row => row.merchantName).map(serializeRequest));
  } catch (error) { return errorResponse(error); }
}
export async function POST(req: Request) {
  try {
    const user = await getUserByWallet((await requireIdentity(req)).walletAddress);
    if (!user) throw new AuthError("Sync your Pocket account first.", 404);
    if (user.role !== "MERCHANT" || !user.businessName) throw new HttpError("Save your business name first.");
    const input = createInvoiceSchema.safeParse(await req.json().catch(() => null));
    if (!input.success) throw new HttpError("Enter a positive mUSD amount, up to two decimals, and a description up to 120 characters.");
    const row = await createPaymentRequest({ creatorAddress: user.walletAddress, merchantName: user.businessName, amount: input.data.amount, description: input.data.description, expiresInHours: expiryToHours(input.data.expiry) });
    return Response.json(serializeRequest(row), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
