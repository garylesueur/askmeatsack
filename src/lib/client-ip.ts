/**
 * Who is calling, for rate-limiting purposes.
 *
 * The only header worth trusting is one the platform sets and a client cannot
 * forge. On Vercel that is `x-vercel-forwarded-for`. `x-forwarded-for` and
 * `x-real-ip` are both attacker-supplied — rotating either gives a fresh
 * rate-limit bucket on every request, which made the limit on the open create
 * endpoint decorative.
 *
 * When no trusted header is present, everyone shares one bucket. That is
 * deliberately blunt: a shared bucket throttles honest traffic, whereas
 * falling back to a spoofable header throttles nobody at all.
 */

/** Set by the platform on every request; not forwardable by a client. */
const TRUSTED_HEADER = "x-vercel-forwarded-for";

/** Every caller shares this when no trusted header is present. */
export const SHARED_BUCKET = "shared";

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get(TRUSTED_HEADER);
  if (!forwarded) {
    return SHARED_BUCKET;
  }
  // The platform sends a single address, but the header is defined as a list.
  // The left-most entry is the one it observed.
  const first = forwarded.split(",")[0]?.trim();
  return first || SHARED_BUCKET;
}
