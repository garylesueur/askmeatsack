import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A link-preview crawler arrives with no session and no cookies, so the card's
 * URL has to carry its own proof. It must not carry the public token: that
 * token opens the questionnaire, and an og:image URL ends up in image proxies,
 * crawler logs, and CDN caches.
 *
 * So the card gets a token derived from the session's own public token. It
 * cannot be reversed into the public token, it cannot be computed by someone
 * holding only a session id, and it needs no new secret to exist.
 */
const PREVIEW_TOKEN_LENGTH = 22;

export function previewTokenFor(input: { sessionId: string; publicToken: string }): string {
  return createHmac("sha256", input.publicToken)
    .update(`link-preview:${input.sessionId}`)
    .digest("base64url")
    .slice(0, PREVIEW_TOKEN_LENGTH);
}

export function previewTokenMatches(
  input: { sessionId: string; publicToken: string },
  candidate: string | undefined,
): boolean {
  if (!candidate) {
    return false;
  }
  const expected = Buffer.from(previewTokenFor(input));
  const given = Buffer.from(candidate);
  if (expected.length !== given.length) {
    return false;
  }
  return timingSafeEqual(expected, given);
}
