import { createHash, timingSafeEqual } from "node:crypto";
import { SESSION_READ_WINDOW_SECONDS } from "./schema";
import type { AccountSessionSummary } from "./sessions";
import type { Appearance, Question, SessionStatus } from "./schema";

export type SessionFile = {
  id: string;
  questionId: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  key?: string;
  uploadedAt?: string;
  retainedUntil?: string;
};

export type SessionAnswer = {
  selectedOptionIds: string[];
  text?: string;
  entries?: Record<string, string>;
  files?: SessionFile[];
  answeredAt: string;
};

export type Session = {
  /** Internal CAS revision; never serialized into the canonical session. */
  storageRevision?: number;
  id: string;
  /** Set only from verified Lanyard authority at creation; never changed by updates. */
  ownerAccountId?: string;
  createdAt: string;
  expiresAt: string;
  submittedAt?: string;
  cancelledAt?: string;
  openedAt?: string;
  status: SessionStatus;
  title?: string;
  context?: string;
  appearance?: Appearance;
  questions: Question[];
  answers: Record<string, SessionAnswer>;
  uploads?: Record<string, SessionFile>;
  publicToken: string;
  agentToken: string;
  metadata?: Record<string, string>;
  callbackUrl?: string;
  callbackSent?: boolean;
};

export type OwnerSessionPage = { sessions: Session[]; nextCursor: string | null };

export function ownerPageOffset(cursor?: string): number {
  if (!cursor) return 0;
  if (!/^(0|[1-9]\d{0,8})$/.test(cursor)) throw new Error("Invalid account cursor");
  return Number(cursor);
}

export function ownerPageLimit(limit = 25): number {
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

function assertOwnerUnchanged(previous: Session | null, next: Session): void {
  if (previous && previous.ownerAccountId !== next.ownerAccountId) {
    throw new Error("Session ownership is immutable");
  }
}

export type SessionClaimSnapshot = { snapshot: string };
export type SessionClaimOutcome = "aborted" | "committed";
export type SessionClaimInspection = "none" | "pending" | "committed" | "foreign";

/** Trusted server-only capabilities, never public source projections. */
export type SessionClaimStore = {
  inspectClaim(id: string, accountId: string, attemptId: string): Promise<SessionClaimInspection>;
  beginClaim(
    id: string,
    accountId: string,
    attemptId: string,
    proof: string,
  ): Promise<SessionClaimSnapshot | null>;
  /** The caller must first reconcile the definitive durable import outcome. */
  resolveClaim(
    id: string,
    accountId: string,
    attemptId: string,
    outcome: SessionClaimOutcome,
  ): Promise<boolean>;
};

export type SessionStore = Partial<SessionClaimStore> & {
  create?(session: Session, fingerprint: string): Promise<Session>;
  listOwnedSummaries?(
    account: string,
    options?: { cursor?: string; limit?: number; search?: string; status?: string },
  ): Promise<{ records: AccountSessionSummary[]; nextCursor: string | null }>;

  save(session: Session): Promise<void>;
  getById(id: string): Promise<Session | null>;
  delete(id: string): Promise<void>;
  listByOwner(
    account: string,
    options?: { cursor?: string; limit?: number },
  ): Promise<OwnerSessionPage>;
};

function claimBinding(id: string, accountId: string, attemptId: string): string | null {
  if (
    !id ||
    id.length > 128 ||
    !accountId ||
    accountId.length > 256 ||
    !attemptId ||
    attemptId.length > 128
  )
    return null;
  return createHash("sha256")
    .update(JSON.stringify([id, accountId, attemptId]))
    .digest("hex");
}
function proofMatches(expected: string, proof: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(expected).digest(),
    createHash("sha256").update(proof).digest(),
  );
}
function canonicalSnapshot(session: Session): string {
  const { storageRevision: _revision, ...canonical } = session;
  return JSON.stringify(canonical);
}
function metadataEndsAt(session: Session): number {
  const ends = [Date.parse(session.expiresAt)];
  if (session.submittedAt) ends.push(Date.parse(session.submittedAt));
  if (session.cancelledAt) ends.push(Date.parse(session.cancelledAt));
  return Math.max(...ends) + SESSION_READ_WINDOW_SECONDS * 1000;
}
type ClaimFence =
  | { state: "pending"; binding: string; snapshot: string; expiresAt: number | null }
  | { state: "committed"; binding: string };

export function createMemorySessionStore(
  now: () => Date = () => new Date(),
): SessionStore & SessionClaimStore {
  const sessions = new Map<string, Session>();
  const owners = new Map<string, Set<string>>();
  const fences = new Map<string, ClaimFence>();
  const aborted = new Set<string>();
  const restoredExpiry = new Map<string, number>();
  function expireRestored(id: string) {
    const ends = restoredExpiry.get(id);
    if (ends !== undefined && ends <= now().getTime()) {
      sessions.delete(id);
      restoredExpiry.delete(id);
    }
  }
  function writable(id: string) {
    if (fences.has(id)) throw new Error("Session claim is fenced");
    expireRestored(id);
  }

  return {
    async save(session: Session): Promise<void> {
      writable(session.id);
      assertOwnerUnchanged(sessions.get(session.id) ?? null, session);
      if (restoredExpiry.has(session.id)) restoredExpiry.set(session.id, metadataEndsAt(session));
      sessions.set(session.id, structuredClone(session));
      if (session.ownerAccountId) {
        const ids = owners.get(session.ownerAccountId) ?? new Set<string>();
        ids.add(session.id);
        owners.set(session.ownerAccountId, ids);
      }
    },
    async getById(id: string): Promise<Session | null> {
      expireRestored(id);
      const session = sessions.get(id);
      return session ? structuredClone(session) : null;
    },
    async delete(id: string): Promise<void> {
      writable(id);
      restoredExpiry.delete(id);
      const owner = sessions.get(id)?.ownerAccountId;
      sessions.delete(id);
      if (owner) {
        owners.get(owner)?.delete(id);
        if (owners.get(owner)?.size === 0) owners.delete(owner);
      }
    },
    async beginClaim(id, accountId, attemptId, proof) {
      const binding = claimBinding(id, accountId, attemptId);
      if (!binding || !proof || proof.length > 1024) return null;
      if (aborted.has(binding)) return null;
      const fence = fences.get(id);
      if (fence) {
        if (fence.state !== "pending" || fence.binding !== binding) return null;
        return proofMatches(JSON.parse(fence.snapshot).agentToken, proof)
          ? { snapshot: fence.snapshot }
          : null;
      }
      expireRestored(id);
      const session = sessions.get(id);
      if (
        !session ||
        session.ownerAccountId !== undefined ||
        !proofMatches(session.agentToken, proof)
      )
        return null;
      const expiresAt = restoredExpiry.get(id) ?? metadataEndsAt(session);
      if (!Number.isFinite(expiresAt) || expiresAt <= now().getTime()) return null;
      const snapshot = canonicalSnapshot(session);
      fences.set(id, { state: "pending", binding, snapshot, expiresAt });
      restoredExpiry.delete(id);
      return { snapshot };
    },
    async inspectClaim(id, accountId, attemptId) {
      const binding = claimBinding(id, accountId, attemptId);
      if (!binding) return "foreign";
      const fence = fences.get(id);
      return !fence ? "none" : fence.binding !== binding ? "foreign" : fence.state;
    },
    async resolveClaim(id, accountId, attemptId, outcome) {
      const binding = claimBinding(id, accountId, attemptId);
      if (!binding || (outcome !== "aborted" && outcome !== "committed")) return false;
      const fence = fences.get(id);
      if (!fence) {
        if (outcome !== "aborted") return false;
        aborted.add(binding); // Durable attempt barrier, even before any fence installation.
        return true;
      }
      if (fence.binding !== binding) return false;
      if (fence.state === "committed") return outcome === "committed";
      if (outcome === "committed") {
        sessions.delete(id);
        restoredExpiry.delete(id);
        fences.set(id, { state: "committed", binding });
      } else {
        fences.delete(id);
        aborted.add(binding);
        if (fence.expiresAt !== null) restoredExpiry.set(id, fence.expiresAt);
        expireRestored(id);
      }
      return true;
    },
    async listByOwner(account, options = {}) {
      const offset = ownerPageOffset(options.cursor);
      const limit = ownerPageLimit(options.limit);
      const owned = [...(owners.get(account) ?? [])]
        .map((id) => sessions.get(id))
        .filter((session): session is Session => session?.ownerAccountId === account)
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      return {
        sessions: structuredClone(owned.slice(offset, offset + limit)),
        nextCursor: owned.length > offset + limit ? String(offset + limit) : null,
      };
    },
  };
}

export type KvClient = {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: Session, opts: { ex: number }) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
  zadd: (key: string, entry: { score: number; member: string }) => Promise<unknown>;
  zrange: <T extends unknown[]>(
    key: string,
    start: number,
    stop: number,
    options?: { rev: boolean },
  ) => Promise<T>;
  zrem: (key: string, ...members: string[]) => Promise<unknown>;
  expire: (key: string, seconds: number, option: "GT" | "NX") => Promise<unknown>;
  eval: (script: string, keys: string[], args: unknown[]) => Promise<unknown>;
};

function sessionKey(id: string): string {
  return `askmeatsack:session:${id}`;
}

function ownerKey(account: string): string {
  return `askmeatsack:owner:${encodeURIComponent(account)}:sessions`;
}

function redisTtlSeconds(session: Session, nowMs: number): number {
  const ends = [Date.parse(session.expiresAt) + SESSION_READ_WINDOW_SECONDS * 1000];
  if (session.submittedAt) {
    ends.push(Date.parse(session.submittedAt) + SESSION_READ_WINDOW_SECONDS * 1000);
  }
  if (session.cancelledAt) {
    ends.push(Date.parse(session.cancelledAt) + SESSION_READ_WINDOW_SECONDS * 1000);
  }
  const until = Math.max(...ends);
  return Math.max(1, Math.ceil((until - nowMs) / 1000));
}

/** Atomic identity check and record/index write. No owner changes are permitted. */
export const SAVE_OWNED_SESSION_LUA = `
if redis.call('EXISTS', KEYS[#KEYS]) == 1 then
  return redis.error_reply('Session claim is fenced')
end
local previous = redis.call('GET', KEYS[1])
if previous then
  local owner = cjson.decode(previous).ownerAccountId
  if owner == nil or owner == cjson.null then owner = '' end
  if owner ~= ARGV[3] then return redis.error_reply('Session ownership is immutable') end
end
if ARGV[6] == '1' then
  local indexType = redis.call('TYPE', KEYS[2]).ok
  if indexType ~= 'none' and indexType ~= 'zset' then
    return redis.error_reply('Invalid session owner index')
  end
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
if ARGV[6] == '1' then
  redis.call('ZADD', KEYS[2], ARGV[4], ARGV[5])
  redis.call('EXPIRE', KEYS[2], ARGV[2], 'NX')
  redis.call('EXPIRE', KEYS[2], ARGV[2], 'GT')
end
return 1
`;

function abortKey(id: string, binding: string): string {
  return `askmeatsack:claim-abort:${id}:${binding}`;
}
function claimKey(id: string): string {
  return `askmeatsack:claim:${id}`;
}

export const BEGIN_SESSION_CLAIM_LUA = `
if redis.call('EXISTS', KEYS[3]) == 1 then return false end
local fenceJson = redis.call('GET', KEYS[2])
if fenceJson then
  local fence = cjson.decode(fenceJson)
  if fence.state ~= 'pending' or fence.binding ~= ARGV[1] then return false end
  local snapshot = cjson.decode(fence.snapshot)
  if snapshot.agentToken ~= ARGV[2] then return false end
  return cjson.encode({snapshot = fence.snapshot})
end
local original = redis.call('GET', KEYS[1])
if not original then return false end
local source = cjson.decode(original)
if (source.ownerAccountId ~= nil and source.ownerAccountId ~= cjson.null) or
   source.agentToken ~= ARGV[2] or source.id ~= ARGV[3] then return false end
local ttl = redis.call('PTTL', KEYS[1])
if ttl == -2 or ttl == 0 then return false end
local expiresAt = cjson.null
if ttl > 0 then
  local clock = redis.call('TIME')
  expiresAt = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000) + ttl
end
if source.storageRevision ~= nil then
  source.storageRevision = nil
  original = cjson.encode(source)
end
redis.call('SET', KEYS[2], cjson.encode({state = 'pending', binding = ARGV[1],
  snapshot = original, expiresAt = expiresAt}))
redis.call('PERSIST', KEYS[1])
return cjson.encode({snapshot = original})
`;

export const RESOLVE_SESSION_CLAIM_LUA = `
if ARGV[2] ~= 'aborted' and ARGV[2] ~= 'committed' then return 0 end
local raw = redis.call('GET', KEYS[2])
if not raw then
  if ARGV[2] ~= 'aborted' then return 0 end
  redis.call('SET', KEYS[3], '1')
  return 1
end
local fence = cjson.decode(raw)
if fence.binding ~= ARGV[1] then return 0 end
if ARGV[2] ~= 'aborted' and ARGV[2] ~= 'committed' then return 0 end
if fence.state == 'committed' then
  if ARGV[2] == 'committed' then return 1 else return 0 end
end
if fence.state ~= 'pending' then return 0 end
if ARGV[2] == 'committed' then
  redis.call('DEL', KEYS[1])
  redis.call('SET', KEYS[2], cjson.encode({state = 'committed', binding = ARGV[1]}))
else
  redis.call('SET', KEYS[1], fence.snapshot)
  if fence.expiresAt ~= cjson.null then redis.call('PEXPIREAT', KEYS[1], fence.expiresAt) end
  redis.call('DEL', KEYS[2])
  redis.call('SET', KEYS[3], '1')
end
return 1
`;

export const INSPECT_SESSION_CLAIM_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return cjson.encode({state = 'none'}) end
local fence = cjson.decode(raw)
if fence.binding ~= ARGV[1] then return cjson.encode({state = 'foreign'}) end
if fence.state ~= 'pending' and fence.state ~= 'committed' then return cjson.encode({state = 'foreign'}) end
return cjson.encode({state = fence.state})
`;

export const DELETE_SESSION_LUA = `
if redis.call('EXISTS', KEYS[2]) == 1 then
  return redis.error_reply('Session claim is fenced')
end
local raw = redis.call('GET', KEYS[1])
if not raw then return '' end
local owner = cjson.decode(raw).ownerAccountId
redis.call('DEL', KEYS[1])
if owner == nil or owner == cjson.null then return '' end
return owner
`;

export function createRedisSessionStore(
  kv: KvClient,
  now: () => Date = () => new Date(),
): SessionStore & SessionClaimStore {
  return {
    async save(session: Session): Promise<void> {
      const ttl = redisTtlSeconds(session, now().getTime());
      const createdAt = Date.parse(session.createdAt);
      if (!Number.isFinite(ttl) || !Number.isFinite(createdAt)) {
        throw new Error("Invalid session timestamps");
      }
      const keys = [sessionKey(session.id)];
      if (session.ownerAccountId) keys.push(ownerKey(session.ownerAccountId));
      keys.push(claimKey(session.id));
      // The ownership check, session TTL and index update share one Redis operation,
      // so concurrent writers cannot reassign a record or leave a partial index.
      await kv.eval(SAVE_OWNED_SESSION_LUA, keys, [
        JSON.stringify(session),
        ttl,
        session.ownerAccountId ?? "",
        createdAt,
        session.id,
        session.ownerAccountId ? "1" : "0",
      ]);
    },
    async getById(id: string): Promise<Session | null> {
      const session = await kv.get<Session>(sessionKey(id));
      return session ?? null;
    },
    async delete(id: string): Promise<void> {
      const owner = await kv.eval(DELETE_SESSION_LUA, [sessionKey(id), claimKey(id)], []);
      if (typeof owner === "string" && owner) await kv.zrem(ownerKey(owner), id);
    },
    async beginClaim(id, accountId, attemptId, proof) {
      const binding = claimBinding(id, accountId, attemptId);
      if (!binding || !proof || proof.length > 1024) return null;
      const raw = await kv.eval(
        BEGIN_SESSION_CLAIM_LUA,
        [sessionKey(id), claimKey(id), abortKey(id, binding)],
        [binding, proof, id],
      );
      if (raw === null || raw === false) return null;
      const result = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!result || typeof result.snapshot !== "string") throw new Error("Invalid claim snapshot");
      const snapshot = JSON.parse(result.snapshot);
      if (
        snapshot.id !== id ||
        snapshot.ownerAccountId !== undefined ||
        !proofMatches(snapshot.agentToken, proof)
      )
        throw new Error("Invalid claim snapshot");
      return { snapshot: result.snapshot };
    },
    async inspectClaim(id, accountId, attemptId) {
      const binding = claimBinding(id, accountId, attemptId);
      if (!binding) return "foreign";
      const raw = await kv.eval(INSPECT_SESSION_CLAIM_LUA, [claimKey(id)], [binding]);
      const result = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!result || !["none", "pending", "committed", "foreign"].includes(result.state))
        throw new Error("Invalid claim inspection");
      return result.state as SessionClaimInspection;
    },
    async resolveClaim(id, accountId, attemptId, outcome) {
      const binding = claimBinding(id, accountId, attemptId);
      if (!binding || (outcome !== "aborted" && outcome !== "committed")) return false;
      return (
        (await kv.eval(
          RESOLVE_SESSION_CLAIM_LUA,
          [sessionKey(id), claimKey(id), abortKey(id, binding)],
          [binding, outcome],
        )) === 1
      );
    },
    async listByOwner(account, options = {}) {
      const offset = ownerPageOffset(options.cursor);
      const limit = ownerPageLimit(options.limit);
      const index = ownerKey(account);
      const ids = await kv.zrange<string[]>(index, offset, offset + limit, { rev: true });
      const rows = await Promise.all(
        ids.slice(0, limit).map((id) => kv.get<Session>(sessionKey(id))),
      );
      const sessions: Session[] = [];
      const stale: string[] = [];
      rows.forEach((session, i) => {
        if (session?.ownerAccountId === account) sessions.push(session);
        else stale.push(ids[i]);
      });
      if (stale.length) await kv.zrem(index, ...stale);
      return {
        sessions,
        nextCursor: ids.length > limit ? String(offset + limit - stale.length) : null,
      };
    },
  };
}
