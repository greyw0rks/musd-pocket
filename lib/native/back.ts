type Handler = () => boolean;
const overlays: Handler[] = [];
let screenBack: Handler | null = null;

export function dispatchPocketBack(): boolean {
  // A provider modal can open above a Pocket sheet.
  if (document.querySelector('[role="dialog"][aria-modal="true"]:not(.pk-sheet)')) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return true;
  }
  const overlay = overlays.at(-1);
  if (overlay?.()) return true;
  // Privy and other dialog libraries already listen for Escape.
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return true;
  }
  return screenBack?.() ?? false;
}

function install() {
  (window as Window & { __pocketAndroidBack?: Handler }).__pocketAndroidBack = dispatchPocketBack;
}

export function registerOverlayBack(handler: Handler): () => void {
  install();
  overlays.push(handler);
  return () => { const index = overlays.indexOf(handler); if (index >= 0) overlays.splice(index, 1); };
}

export function registerScreenBack(handler: Handler): () => void {
  install();
  screenBack = handler;
  return () => { if (screenBack === handler) screenBack = null; };
}
