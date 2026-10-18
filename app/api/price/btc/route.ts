/**
 * The BTC spot price, in micro-dollars, for the Home total.
 *
 * BTC is the wallet's gas balance, and until now the app printed the amount and
 * left it out of the total because nothing here priced it. That was honest but
 * incomplete: the card says "Total balance", and a total that silently omits a
 * holding the user can see named two lines below is a number they will read as
 * everything they have. This route is what closes that gap — it is the one
 * place a BTC price enters the app.
 *
 * It answers in **micro-dollars** (`usdMicros`), an integer in a string, and
 * deliberately not a JSON number. A float crossing the wire is a rounding error
 * the client then multiplies by a balance and prints to the cent; an integer
 * keeps the whole conversion (`btcValueUnits`, in `features/payments/amount.ts`)
 * in exact bigint arithmetic alongside the rest of the money code.
 *
 * Two public, keyless sources are tried in order. Neither is authoritative, and
 * a disagreement between them is worth a rounding error on the last cent of a
 * total — but one source is one point of failure for a figure the user reads as
 * fact. When *every* source fails this returns 503 rather than a stale or
 * invented number, and the card says the holding is unpriced: the app's answer
 * to "I do not know" is to say so.
 *
 * ## Why the caching is hand-rolled
 *
 * Route handlers in this Next version are **not cached by default** — the
 * bundled docs say so outright, and opting in means `dynamic = 'force-static'`,
 * which would also run the upstream fetch at build time. That is the wrong
 * trade for a price: a build with no network would fail, or worse, bake a
 * figure into the deployment. So caching is done here instead, in the two
 * layers that do not depend on the framework's model:
 *
 *   - a **process memo**, so one warm instance asks upstream at most once a
 *     minute no matter how many clients ask it; and
 *   - a **`Cache-Control` header**, so the CDN answers everyone else and the
 *     upstream sees roughly one request a minute in total.
 *
 * The browser is deliberately left out of both: `s-maxage` binds shared caches
 * only, so each client revalidates and gets the CDN's copy rather than holding
 * a price of its own.
 */

/** How long a reading is good for. Matches the client's refresh cadence. */
const REVALIDATE_SECONDS = 60;

/** How long to wait on any one source before moving to the next. */
const SOURCE_TIMEOUT_MS = 5_000;

/**
 * A public spot source: where to ask, and how to read its answer.
 *
 * `read` returns `null` for anything it does not recognise rather than
 * throwing, so a source that changes its response shape drops to the next one
 * instead of taking the route down with it.
 */
interface PriceSource {
  name: string;
  url: string;
  read: (body: unknown) => number | null;
}

const SOURCES: readonly PriceSource[] = [
  {
    name: "coingecko",
    url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    read: (body) => {
      const usd = (body as { bitcoin?: { usd?: unknown } } | null)?.bitcoin?.usd;
      return typeof usd === "number" ? usd : null;
    },
  },
  {
    name: "coinbase",
    // Coinbase quotes spot as a decimal string.
    url: "https://api.coinbase.com/v2/prices/BTC-USD/spot",
    read: (body) => {
      const amount = (body as { data?: { amount?: unknown } } | null)?.data?.amount;
      if (typeof amount !== "string") return null;
      const usd = Number(amount);
      return Number.isFinite(usd) ? usd : null;
    },
  },
];

/**
 * Dollars to micro-dollars.
 *
 * `Math.round` on a float *here* is safe in a way it would not be downstream:
 * a spot price is a handful of significant figures, far inside the range where
 * a double is exact to the millionth, and this is the last time the value is a
 * float at all. Everything after it — multiply by a balance, sum, format — is
 * integer arithmetic.
 */
function toMicros(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

/** The last reading this instance fetched, and when. */
let memo: { at: number; usdMicros: bigint; source: string } | null = null;

/** A price, with the caching headers that make it one. */
function ok(usdMicros: bigint, source: string): Response {
  return Response.json(
    { usdMicros: usdMicros.toString(), source },
    {
      headers: {
        "cache-control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=300`,
      },
    },
  );
}

export async function GET() {
  if (memo && Date.now() - memo.at < REVALIDATE_SECONDS * 1000) {
    return ok(memo.usdMicros, memo.source);
  }

  for (const source of SOURCES) {
    try {
      const res = await fetch(source.url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
        // Uncached on purpose: the memo above decides how often upstream is
        // asked, and letting the framework cache as well would put the two on
        // separate clocks with no way to reason about which one answered.
        cache: "no-store",
      });
      if (!res.ok) continue;

      const usd = source.read(await res.json());
      /*
        A price of zero is not a price. It is what a source answers when it is
        rate-limiting or degraded, and folding it into the total would erase
        the user's BTC from a figure that claims to be everything they hold.
        Treated as a failure, so the next source gets a turn.
      */
      if (usd === null || !(usd > 0)) continue;

      memo = { at: Date.now(), usdMicros: toMicros(usd), source: source.name };
      return ok(memo.usdMicros, memo.source);
    } catch (e) {
      console.error("[pocket] btc price source failed", {
        source: source.name,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /*
    No price, and no guess. 503 rather than a 200 with a null in it, so a caller
    that only checks `res.ok` cannot mistake this for a reading — the client
    treats any non-OK as "unpriced", which is the truthful state.
  */
  return Response.json(
    { error: "No BTC price source answered" },
    { status: 503 },
  );
}
