import { createHmac, timingSafeEqual } from "node:crypto";
import type { AskMetadata } from "./owned-session-metadata";
import type { AskObjects } from "./owned-answer-objects";
export type AskCleanupGrant = {
  id: string;
  keys: string[];
  writeDeadlineAt: number;
  cleanupAt: number;
};
export function verifyAskCleanupSignature(
  payload: string,
  header: string | null,
  secret: string,
  now = Date.now(),
) {
  const match = /^t=(\d{1,12}),v1=([a-f0-9]{64})$/.exec(header ?? "");
  if (!secret || !match || Math.abs(now - Number(match[1]) * 1000) > 300000) return false;
  const expected = createHmac("sha256", secret)
    .update(`${match[1]}.ask-cleanup.${payload}`)
    .digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(match[2], "hex"));
}
export async function executeAskCleanup(
  input: { id: string },
  deps: { metadata: AskMetadata; objects: AskObjects; now?: () => number },
) {
  const now = deps.now ?? Date.now;
  const first = await deps.metadata.call<AskCleanupGrant | null>("authorizeCleanup", input);
  if (!first) return { ok: false, pendingCleanup: false };
  if (now() < first.cleanupAt || now() < first.writeDeadlineAt)
    return { ok: false, pendingCleanup: true };
  // Revalidate immediately before touching storage. Retried jobs can only remove
  // the same frozen staging/seal keys, never a replacement or live kept copy.
  const grant = await deps.metadata.call<AskCleanupGrant | null>("authorizeCleanup", input);
  if (
    !grant ||
    grant.id !== first.id ||
    grant.cleanupAt !== first.cleanupAt ||
    grant.writeDeadlineAt !== first.writeDeadlineAt ||
    JSON.stringify(grant.keys) !== JSON.stringify(first.keys)
  )
    return { ok: false, pendingCleanup: true };
  if (
    grant.keys.length > 16 ||
    grant.keys.some(
      (key) => !/^askmeatsack\/(owned|kept)\/[A-Za-z0-9_-]+\/[A-Za-z0-9_/-]+$/.test(key),
    )
  )
    throw new Error("Invalid cleanup authority");
  const absent = await Promise.all(
    grant.keys.map(async (key) => {
      if (await deps.objects.head(key)) await deps.objects.delete(key);
      return (await deps.objects.head(key)) === null;
    }),
  );
  if (absent.some((value) => !value)) return { ok: false, pendingCleanup: true };
  return { ok: true, pendingCleanup: false };
}
