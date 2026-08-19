import { lookup } from "node:dns/promises";
import { addressFamily, isBlockedAddress } from "./callback-url";

/**
 * The DNS half of the callback check. Server-only — it imports `node:dns`, so
 * nothing a client component can reach may import this file. The pure checks
 * live in `callback-url.ts` and are safe to share.
 */

/**
 * Resolves the host and refuses if any address it answers with is private.
 * Every address is checked, not just the first — a name that returns one public
 * and one private address is still a way in.
 */
export async function callbackHostResolvesPublicly(
  hostname: string,
  resolve: (host: string) => Promise<{ address: string }[]> = (host) => lookup(host, { all: true }),
): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (addressFamily(host) !== 0) {
    return !isBlockedAddress(host);
  }
  try {
    const addresses = await resolve(host);
    if (addresses.length === 0) {
      return false;
    }
    return addresses.every((entry) => !isBlockedAddress(entry.address));
  } catch {
    return false;
  }
}
