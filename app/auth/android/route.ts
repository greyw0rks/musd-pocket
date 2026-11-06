import { randomBytes } from "node:crypto";

// Standalone callback: no app layout, wallet provider or PWA installation screen.
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  let valid = params.get("privy_oauth_provider") === "twitter";
  for (const key of ["privy_oauth_code", "privy_oauth_state", "privy_oauth_provider"]) {
    const values = params.getAll(key);
    const value = values[0] ?? "";
    if (values.length !== 1 || !value || value.length > (key === "privy_oauth_code" ? 4096 : 512) || /[\x00-\x1f\x7f]/.test(value)) valid = false;
    query.set(key, value);
  }
  const intent = `intent://mpocket.tech/auth/android?${query}#Intent;scheme=https;package=tech.mpocket.testing;end`;
  const nonce = randomBytes(16).toString("base64");
  const safeIntent = JSON.stringify(intent).replace(/</g, "\\u003c");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Return to mPocket</title><style nonce="${nonce}">body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f4f6;color:#171719;font:17px system-ui}main{max-width:360px;padding:28px}h1{font-size:30px}a{display:block;background:#171719;color:white;text-align:center;padding:15px;border-radius:14px;text-decoration:none;margin-top:24px}p{line-height:1.5}</style></head><body><main><h1>mPocket</h1><p>${valid ? "Your sign-in is ready to return to mPocket. Tap below if the app hasn’t opened." : "Sign-in wasn’t completed. Return to mPocket and try again."}</p><a id="return" href="intent://mpocket.tech/home#Intent;scheme=https;package=tech.mpocket.testing;end">Return to mPocket</a></main><script nonce="${nonce}">history.replaceState(null,"","/auth/android");${valid ? `const target=${safeIntent};document.getElementById("return").href=target;window.location.replace(target);` : ""}</script></body></html>`;
  return new Response(html, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
  } });
}
