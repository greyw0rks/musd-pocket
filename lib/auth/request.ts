import "server-only";
import { identityFromToken, type PrivyIdentity } from "@/lib/auth/privy-server";

/** Auth failure that carries an HTTP status for the route handler to surface. */
export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/** A client-fixable request error (bad input, business-rule violation) → 4xx. */
export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/** Pull the `Authorization: Bearer <token>` value, or throw AuthError. */
export function bearerToken(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new AuthError("Missing bearer token");
  }
  return token;
}

/** Verify the request's Privy token and resolve the identity behind it. */
export async function requireIdentity(req: Request): Promise<PrivyIdentity> {
  const token = bearerToken(req);
  try {
    return await identityFromToken(token);
  } catch (e) {
    throw new AuthError(e instanceof Error ? e.message : "Invalid token");
  }
}

/** Shape an error into a JSON Response, honoring AuthError/HttpError statuses. */
export function errorResponse(e: unknown): Response {
  if (e instanceof AuthError || e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  // LedgerError (lib/ledger/service) is a client-fixable business-rule failure
  // — e.g. insufficient balance — matched by name to avoid a server-only import.
  if (e instanceof Error && e.name === "LedgerError") {
    return Response.json({ error: e.message }, { status: 400 });
  }
  const message = e instanceof Error ? e.message : "Unexpected error";
  return Response.json({ error: message }, { status: 500 });
}
