import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/**
 * Where a `callbackUrl` is allowed to point.
 *
 * The agent supplies this and the server fetches it, so without a check it is a
 * request forgery primitive: anything reachable from the function can be probed,
 * and response timing tells the caller what answered. Spec invariant, in
 * `questionnaire/sessions/answering.md`:
 *
 *   A `callbackUrl` is public HTTPS. Private, loopback, and link-local
 *   addresses are refused, and a redirect away from the address given is not
 *   followed.
 *
 * Checked twice on purpose. `callbackUrlIsUsable` runs at create, so the agent
 * hears about a bad address while it can still fix it. The resolved-address
 * check runs again at delivery, because DNS can change between the two.
 */

export type CallbackRefusal = { ok: false; reason: string };
export type CallbackAccepted = { ok: true; url: URL };
export type CallbackCheck = CallbackAccepted | CallbackRefusal;

/** Ranges that are never a legitimate destination for a callback. */
function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true; // this host, private, loopback
  if (a === 169 && b === 254) return true; // link-local, and cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 192 && b === 0) return true; // protocol assignments
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

function isBlockedIpv6(address: string): boolean {
  const lower = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "::" || lower === "::1") return true; // unspecified, loopback
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  // IPv4 written inside IPv6, which would otherwise slip past the checks above.
  const mapped = lower.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isBlockedIpv4(mapped[1]);
  return false;
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return true; // not an address we can reason about
}

/**
 * Shape check only — no DNS. Safe to run at create, where a slow or hanging
 * resolver would hold up the agent's call.
 */
export function callbackUrlIsUsable(raw: string): CallbackCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "callbackUrl is not a usable URL" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "callbackUrl must be https" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "callbackUrl must not carry credentials" };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // A literal address skips DNS entirely, so judge it here.
  if (isIP(host) && isBlockedAddress(host)) {
    return { ok: false, reason: "callbackUrl must be a public address" };
  }
  if (host === "localhost" || host.endsWith(".localhost")) {
    return { ok: false, reason: "callbackUrl must be a public address" };
  }
  return { ok: true, url };
}

/**
 * Resolves the host and refuses if any address it answers with is private.
 * Every address is checked, not just the first — a name that returns one public
 * and one private address is still a way in.
 */
export async function callbackHostResolvesPublicly(
  hostname: string,
  resolve: (host: string) => Promise<{ address: string }[]> = (host) =>
    lookup(host, { all: true }),
): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
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
