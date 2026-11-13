// Read-only provider configuration and OAuth initiation; no account login.
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
let appId;
for (const file of [".env", ".env.local"]) {
  const env = await readFile(file, "utf8").catch(() => "");
  const value = env.match(/^NEXT_PUBLIC_PRIVY_APP_ID=["']?([^\r\n"']+)/m)?.[1];
  if (value) appId = value;
}
if (!appId) throw Error("Public Privy app ID is required");
const headers = { "privy-app-id": appId, "Content-Type": "application/json", Origin: "https://mpocket.tech" };
const response = await fetch(`https://auth.privy.io/api/v1/apps/${appId}`, { headers });
if (!response.ok) throw Error(`App config returned ${response.status}`);
const config = await response.json();
const providers = {};
for (const provider of ["twitter", "google", "telegram"]) {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const init = await fetch("https://auth.privy.io/api/v1/oauth/init", { method: "POST", headers, body: JSON.stringify({ provider, redirect_to: "https://mpocket.tech/auth/android", state_code: state, code_challenge: createHash("sha256").update(verifier).digest("base64url") }) });
  const result = await init.json();
  providers[provider] = { authEnabled: config[`${provider}_auth`] ?? null, oauthEnabled: config[`${provider}_oauth`] ?? null, initiationStatus: init.status, authorizationHost: result.url ? new URL(result.url).hostname : null, errorCode: result.code ?? null };
}
const result = { createdAt: new Date().toISOString(), providers, accountLoginPerformed: false };
await writeFile("docs/evidence/android/auth-provider-config.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
