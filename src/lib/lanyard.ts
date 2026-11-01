import { createTokenVerifier, type ProductVerificationOutcome } from "./product-verifier";

/**
 * lanyard is the one sign-in service. People sign in there; agents present a
 * lanyard token to us as `Authorization: Bearer`. This product never runs a
 * sign-in screen of its own.
 *
 * Everything here is inert until `LANYARD_URL` is set. With it unset, nothing
 * calls lanyard and nothing links to it.
 */

/** The product key lanyard knows us by. */
export const LANYARD_PRODUCT = "askmeatsack";

/**
 * The configured lanyard origin, or undefined when unset. A value that is not
 * an http(s) URL counts as unset, so a typo in config leaves the product
 * behaving as it does without lanyard rather than failing every create.
 */
export function lanyardOrigin(): string | undefined {
  const raw = process.env.LANYARD_URL?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/** Where the brand nav's "Sign in" goes. Undefined hides it. */
export function lanyardSignInHref(): string | undefined {
  const origin = lanyardOrigin();
  return origin ? `${origin}/sign-in?product=${LANYARD_PRODUCT}` : undefined;
}

const globalForLanyard = globalThis as typeof globalThis & {
  askmeatsackLanyardVerifier?: {
    origin: string;
    verify: (token: string) => Promise<ProductVerificationOutcome>;
  };
};

/**
 * Verifies a presented lanyard token. One verifier per process and origin, so
 * the grace cache survives between requests on a warm instance.
 */
export function verifyLanyardToken(
  origin: string,
  token: string,
): Promise<ProductVerificationOutcome> {
  const existing = globalForLanyard.askmeatsackLanyardVerifier;
  if (existing && existing.origin === origin) {
    return existing.verify(token);
  }
  const verify = createTokenVerifier({
    lanyardUrl: origin,
    product: LANYARD_PRODUCT,
    // Looked up per call rather than captured once, so this long-lived
    // verifier always uses the runtime's current fetch.
    fetch: (input, init) => globalThis.fetch(input, init),
  });
  globalForLanyard.askmeatsackLanyardVerifier = { origin, verify };
  return verify(token);
}
