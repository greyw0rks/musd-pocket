type NativeReply = { id: number; result?: string | null; error?: string };
type NativePort = { postMessage: (message: string) => void; onmessage: ((event: MessageEvent<string>) => void) | null };
const pending = new Map<number, { resolve: (value: string | null) => void; reject: (reason: Error) => void; timer: number }>();
let sequence = 0;

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
  if (!bridge) return;
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
  // The Android share sheet is available even on WebViews without Web Share.
  Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
    if (data.files?.length) throw new Error("Share a payment link rather than a file.");
    await request("share", [data.title, data.text, data.url].filter(Boolean).join("\n"));
  } });
}
