const ID = /^(?:[A-HJ-NP-Z2-9]{5}|[A-HJ-NP-Z2-9]{24})$/;

export function normalizeRequestId(value: string): string | null {
  const id = value.toUpperCase();
  return ID.test(id) ? id : null;
}

export function checkoutPath(id: string): string {
  const normalized = normalizeRequestId(id);
  if (!normalized) throw new Error("Invalid payment link");
  return `/pay/${normalized}`;
}

/** Pasted checkout links can navigate only within this Pocket origin. */
export function parseCheckoutLink(
  input: string,
  origin: string,
): string | null {
  try {
    const url = new URL(input.trim(), origin);
    if (url.origin !== new URL(origin).origin || url.username || url.password)
      return null;
    const match = /^\/pay\/([^/]+)\/?$/.exec(url.pathname);
    const id = match && normalizeRequestId(match[1]);
    return id ? checkoutPath(id) : null;
  } catch {
    return null;
  }
}
