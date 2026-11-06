type NativeReply = { id: number; result?: string | null; error?: string };
type NativePort = { postMessage: (message: string) => void; onmessage: ((event: MessageEvent<string>) => void) | null };
const pending = new Map<number, { resolve: (value: string | null) => void; reject: (reason: Error) => void; timer: number }>();
let sequence = 0;
let installed = false;

export const ANDROID_OAUTH_CALLBACK = "https://mpocket.tech/auth/android";

/** Keep Privy's PKCE verifier in this WebView; only authorization uses the browser. */
function installBrowserAuth(): void {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, options) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== "https://auth.privy.io/api/v1/oauth/init" ||
      (options?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase() !== "POST") {
      return originalFetch(input, options);
    }
    const body = options?.body ?? (input instanceof Request ? await input.clone().text() : undefined);
    if (typeof body !== "string") return originalFetch(input, options);
    let data: Record<string, unknown>;
    try { data = JSON.parse(body); } catch { return originalFetch(input, options); }
    if (!["twitter", "google"].includes(String(data.provider))) return originalFetch(input, options);
    const returnUrl = new URL(window.location.href);
    if (returnUrl.origin !== "https://mpocket.tech" ||
      !(returnUrl.pathname === "/home" || returnUrl.pathname.startsWith("/pay/"))) {
      throw new Error("Open mPocket before signing in.");
    }
    for (const key of ["privy_oauth_code", "privy_oauth_state", "privy_oauth_provider"]) returnUrl.searchParams.delete(key);
    const response = await originalFetch(input, { ...options, body: JSON.stringify({ ...data, redirect_to: ANDROID_OAUTH_CALLBACK }) });
    if (response.ok) {
      const result = await response.clone().json();
      await request("prepareOAuth", JSON.stringify({ authorizationUrl: result.url, state: data.state_code, provider: data.provider, returnUrl: returnUrl.href }));
    }
    return response;
  };
}

function port(): NativePort | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { PocketNative?: NativePort }).PocketNative;
}

export function hasNativeScanner(): boolean { return Boolean(port()); }

function request(action: string, value?: string): Promise<string | null> {
  const bridge = port();
  if (!bridge) return Promise.reject(new Error("This feature needs the Android app."));
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { pending.delete(id); reject(new Error("The action timed out. Please try again.")); }, 120_000);
    pending.set(id, { resolve, reject, timer });
    bridge.postMessage(JSON.stringify({ id, action, value }));
  });
}

export function scanNativeQr(): Promise<string | null> { return request("scan"); }

export function installNativeAdapters(): void {
  const bridge = port();
  if (!bridge || installed) return;
  installed = true;
  document.documentElement.dataset.pocketRuntime = "android";
  bridge.onmessage = ({ data }) => {
    let reply: NativeReply;
    try { reply = JSON.parse(data); } catch { return; }
    const item = pending.get(reply.id);
    if (!item) return;
    pending.delete(reply.id);
    window.clearTimeout(item.timer);
    if (reply.error) item.reject(new Error(reply.error));
    else item.resolve(reply.result ?? null);
  };
  installBrowserAuth();
  // The Android share sheet is available even on WebViews without Web Share.
  Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
    if (data.files?.length) throw new Error("Share a payment link rather than a file.");
    await request("share", [data.title, data.text, data.url].filter(Boolean).join("\n"));
  } });
}
