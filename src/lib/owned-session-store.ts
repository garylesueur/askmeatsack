import { canonicalSessionJson } from "./owned-session-capacity";
import { OwnedSessionError, type AskMetadata, type OwnedEnvelope } from "./owned-session-metadata";
import type { Session, SessionClaimStore, SessionStore } from "./session-store";

export function sessionFromEnvelope(value: OwnedEnvelope): Session {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.session);
  } catch {
    throw new OwnedSessionError("storage_unavailable");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("id" in parsed) ||
    !("ownerAccountId" in parsed) ||
    typeof parsed.id !== "string" ||
    typeof parsed.ownerAccountId !== "string" ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0
  )
    throw new OwnedSessionError("storage_unavailable");
  return { ...parsed, storageRevision: value.revision } as Session;
}

/** Retired authority is definitive: a legacy row must never resurrect its ID. */
export function createOwnedSessionStore(
  legacy: SessionStore,
  metadata: AskMetadata | null,
): SessionStore {
  const beginClaim = legacy.beginClaim?.bind(legacy);
  const resolveClaim = legacy.resolveClaim?.bind(legacy);
  const inspectClaim = legacy.inspectClaim?.bind(legacy);
  const claims: Partial<SessionClaimStore> =
    beginClaim && resolveClaim && inspectClaim
      ? {
          async beginClaim(id, accountId, attemptId, proof) {
            // Preparation needs definitive durable authority before pinning a source.
            if (!metadata) throw new OwnedSessionError("storage_unavailable");
            const overlay = await metadata.call<OwnedEnvelope | { retired: true } | null>(
              "getById",
              { id },
            );
            if (overlay !== null) return null;
            return beginClaim(id, accountId, attemptId, proof);
          },
          // A committed durable overlay must not prevent retiring its old source.
          // Only a trusted caller with the definitive native receipt may resolve.
          resolveClaim,
          inspectClaim,
        }
      : {};
  return {
    ...claims,
    async create(session, fingerprint) {
      if (!session.ownerAccountId) {
        await legacy.save(session);
        return session;
      }
      if (!metadata) throw new OwnedSessionError("storage_unavailable");
      return sessionFromEnvelope(
        await metadata.call<OwnedEnvelope>("create", {
          session: canonicalSessionJson(session),
          fingerprint,
        }),
      );
    },
    async getById(id) {
      if (metadata) {
        const value = await metadata.call<OwnedEnvelope | { retired: true } | null>("getById", {
          id,
        });
        if (value) return "retired" in value ? null : sessionFromEnvelope(value);
      }
      return legacy.getById(id);
    },
    async save(session) {
      if (session.storageRevision === undefined) return legacy.save(session);
      if (!metadata || !session.ownerAccountId) throw new OwnedSessionError("storage_unavailable");
      const result = await metadata.call<OwnedEnvelope | null>("compareAndSave", {
        id: session.id,
        accountId: session.ownerAccountId,
        expectedRevision: session.storageRevision,
        session: canonicalSessionJson(session),
      });
      if (!result) throw new OwnedSessionError("conflict", 409);
      session.storageRevision = result.revision;
    },
    async delete(id) {
      const value = await this.getById(id);
      if (value?.storageRevision !== undefined) {
        if (!metadata) throw new OwnedSessionError("storage_unavailable");
        await metadata.call("delete", { id, accountId: value.ownerAccountId });
      } else await legacy.delete(id);
    },
    async listByOwner(accountId, options = {}) {
      const page = await legacy.listByOwner(accountId, options);
      if (!metadata) return page;
      const authoritative = await Promise.all(
        page.sessions.map(async (session) => {
          const row = await metadata.call<OwnedEnvelope | { retired: true } | null>("getById", {
            id: session.id,
          });
          return row === null ? session : null;
        }),
      );
      return { ...page, sessions: authoritative.filter((row): row is Session => row !== null) };
    },
    ...(metadata
      ? {
          async listOwnedSummaries(
            accountId: string,
            options: { cursor?: string; limit?: number; search?: string; status?: string } = {},
          ) {
            // Durable summary pages are bounded metadata reads; do not fetch canonical payloads here.
            return metadata.call<{
              records: import("./sessions").AccountSessionSummary[];
              nextCursor: string | null;
            }>("listByOwner", { accountId, ...options });
          },
        }
      : {}),
  };
}
