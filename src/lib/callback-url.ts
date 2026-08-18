/**
 * Where a `callbackUrl` is allowed to point.
 *
 * Deliberately free of Node built-ins. `schema.ts` imports this so create can
 * refuse a bad address, and client components import `schema.ts` for their
 * types — so a `node:net` import here ends up in the browser bundle and fails
 * the build. DNS resolution lives in `callback-dns.ts`, which is server-only.
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

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** 4, 6, or 0 for "not an address". Enough to pick a blocklist. */
export function addressFamily(value: string): 0 | 4 | 6 {
  const match = IPV4.exec(value);
  if (match) {
    return match.slice(1).every((part) => Number(part) <= 255) ? 4 : 0;
  }
  return value.includes(":") ? 6 : 0;
}

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
  const family = addressFamily(address);
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
  if (addressFamily(host) !== 0 && isBlockedAddress(host)) {
    return { ok: false, reason: "callbackUrl must be a public address" };
  }
  if (host === "localhost" || host.endsWith(".localhost")) {
    return { ok: false, reason: "callbackUrl must be a public address" };
  }
  return { ok: true, url };
}
