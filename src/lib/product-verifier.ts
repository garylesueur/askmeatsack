/**
 * Copied verbatim from lanyard. Do not edit here.
 * Canonical source: garylesueur/lanyard, main, src/lib/verification/product-verifier.ts
 * (copied at d73124d). Change it there, then copy it again.
 */

/**
 * The verifier the three products run.
 *
 * Deliberately self-contained — no imports from the rest of lanyard — because
 * askmeatsack, showmeatsack, and cleanroom each take a copy. Every behaviour a
 * product must get right lives here rather than being described in prose and
 * reimplemented three times.
 */

export type ProductVerificationOutcome =
  | { readonly outcome: "accepted"; readonly account: string; readonly stale: boolean }
  | { readonly outcome: "refused" };

/**
 * The longest a product may keep answering from a previous verification while
 * lanyard is unreachable. A revoked token keeping its power for five minutes is
 * acceptable; every product failing the moment lanyard hiccups is not.
 */
export const MAX_GRACE_WINDOW_MS = 5 * 60 * 1000;

type CacheEntry = {
  readonly account: string;
  readonly verifiedAt: number;
};

export type GraceCache = {
  get(key: string): CacheEntry | undefined;
  set(key: string, entry: CacheEntry): void;
  delete(key: string): void;
};

/** In-process by default. One instance per product process is enough. */
export function createMemoryGraceCache(): GraceCache {
  const entries = new Map<string, CacheEntry>();
  return {
    get: (key) => entries.get(key),
    set: (key, entry) => {
      entries.set(key, entry);
    },
    delete: (key) => {
      entries.delete(key);
    },
  };
}

export type ProductVerifierOptions = {
  /** Origin of lanyard, e.g. https://lanyard.example. */
  readonly lanyardUrl: string;
  /** Which product is asking. */
  readonly product: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => number;
  /** Clamped to MAX_GRACE_WINDOW_MS. */
  readonly graceWindowMs?: number;
  readonly cache?: GraceCache;
  /** Milliseconds before an unanswered verification counts as unreachable. */
  readonly timeoutMs?: number;
};

export function createTokenVerifier(options: ProductVerifierOptions) {
  const doFetch = options.fetch ?? globalThis.fetch;
  const now = options.now ?? (() => Date.now());
  const cache = options.cache ?? createMemoryGraceCache();
  const graceWindowMs = Math.min(options.graceWindowMs ?? MAX_GRACE_WINDOW_MS, MAX_GRACE_WINDOW_MS);
  const timeoutMs = options.timeoutMs ?? 3000;
  const endpoint = new URL("/api/v1/verify", options.lanyardUrl).toString();

  return async function verify(
    presented: string | null | undefined,
  ): Promise<ProductVerificationOutcome> {
    if (typeof presented !== "string" || presented.trim().length === 0) {
      return { outcome: "refused" };
    }
    const token = presented.trim();
    // Keyed by a hash so nothing here is a working token. A product verifies
    // and discards; it never stores what it was given.
    const key = `${options.product}:${await sha256Hex(token)}`;

    let answered: Response | undefined;
    try {
      answered = await doFetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, product: options.product }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return fromGrace(cache, key, now(), graceWindowMs);
    }

    if (answered.status === 200) {
      const account = await readAccount(answered);
      if (account === null) {
        // A malformed answer is not a refusal by lanyard, so the grace window
        // still applies rather than the token being rejected on our mistake.
        return fromGrace(cache, key, now(), graceWindowMs);
      }
      cache.set(key, { account, verifiedAt: now() });
      return { outcome: "accepted", account, stale: false };
    }

    if (answered.status === 401) {
      // lanyard was reachable and said no. Whatever the cause, this token is
      // finished here — including any previous answer we were holding.
      cache.delete(key);
      return { outcome: "refused" };
    }

    // Anything else is lanyard being unwell rather than lanyard answering.
    return fromGrace(cache, key, now(), graceWindowMs);
  };
}

function fromGrace(
  cache: GraceCache,
  key: string,
  at: number,
  graceWindowMs: number,
): ProductVerificationOutcome {
  const entry = cache.get(key);
  // Never applies to a token this product has never successfully verified.
  if (!entry) return { outcome: "refused" };
  if (at - entry.verifiedAt > graceWindowMs) {
    cache.delete(key);
    return { outcome: "refused" };
  }
  return { outcome: "accepted", account: entry.account, stale: true };
}

async function readAccount(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null) return null;
    const account = (body as { account?: unknown }).account;
    return typeof account === "string" && account.length > 0 ? account : null;
  } catch {
    return null;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
