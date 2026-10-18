/*
  Pocket's service worker.

  It exists for one reason: Chrome will not offer "Install app" unless a
  registered worker has a fetch handler. That is the whole job.

  It deliberately caches **nothing**. Pocket shows a balance, and a balance is
  the one number in a wallet that must never be older than the chain. A cache
  that keeps serving the last known total after a send is not a performance
  feature, it is a lie about how much money someone has — and the failure is
  invisible to the person it hurts. Every request below falls through to the
  network, exactly as if there were no worker at all.

  If offline support is ever wanted, it belongs on the static shell only
  (`/icons/*`, fonts), never on `/api/*` and never on a balance read.
*/

self.addEventListener("install", () => {
  // Take over on the next load rather than waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A fetch listener with no answer: the browser handles the request normally.
self.addEventListener("fetch", () => {});
