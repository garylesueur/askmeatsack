/* eslint-disable no-await-in-loop -- Sequential mock replies verify raw and decoded Redis claim results. */
import { describe, expect, it, vi } from "vitest";
import {
  BEGIN_SESSION_CLAIM_LUA,
  INSPECT_SESSION_CLAIM_LUA,
  DELETE_SESSION_LUA,
  RESOLVE_SESSION_CLAIM_LUA,
  SAVE_OWNED_SESSION_LUA,
  createMemorySessionStore,
  createRedisSessionStore,
  type KvClient,
  type Session,
} from "./session-store";

const sample: Session = {
  id: "session-1",
  createdAt: "2026-08-16T20:00:00.000Z",
  expiresAt: "2026-08-17T20:00:00.000Z",
  status: "pending",
  questions: [],
  answers: {},
  publicToken: "public",
  agentToken: "agent",
};

function createFakeKv(): KvClient & { values: Map<string, Session> } {
  const values = new Map<string, Session>();
  const indexes = new Map<string, Map<string, number>>();
  return {
    values,
    async get(key) {
      return (values.get(key) as never) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async del(key) {
      values.delete(key);
    },
    async zadd(key, { score, member }) {
      const index = indexes.get(key) ?? new Map<string, number>();
      index.set(member, score);
      indexes.set(key, index);
    },
    async zrange<T extends unknown[]>(key: string, start: number, stop: number) {
      return [...(indexes.get(key)?.entries() ?? [])]
        .toSorted(([a, sa], [b, sb]) => sb - sa || b.localeCompare(a))
        .slice(start, stop + 1)
        .map(([id]) => id) as T;
    },
    async zrem(key, ...members) {
      for (const id of members) indexes.get(key)?.delete(id);
    },
    async expire() {},
    async eval(script, keys, args) {
      if (script === DELETE_SESSION_LUA) {
        const previous = values.get(keys[0]);
        values.delete(keys[0]);
        return previous?.ownerAccountId ?? "";
      }
      const session = JSON.parse(String(args[0])) as Session;
      const previous = values.get(keys[0]);
      if (previous && previous.ownerAccountId !== session.ownerAccountId)
        throw new Error("Session ownership is immutable");
      values.set(keys[0], session);
      if (args[5] === "1") {
        const index = indexes.get(keys[1]) ?? new Map<string, number>();
        index.set(String(args[4]), Number(args[3]));
        indexes.set(keys[1], index);
      }
      return 1;
    },
  };
}

describe("session stores", () => {
  it("memory store round-trips a session", async () => {
    const store = createMemorySessionStore();
    await store.save(sample);
    expect(await store.getById("session-1")).toEqual(sample);
    await store.delete("session-1");
    expect(await store.getById("session-1")).toBeNull();
  });

  it("redis store writes JSON under a namespaced key", async () => {
    const kv = createFakeKv();
    const store = createRedisSessionStore(kv, () => new Date("2026-08-16T20:00:00.000Z"));
    await store.save(sample);
    expect(kv.values.get("askmeatsack:session:session-1")).toEqual(sample);
    expect(await store.getById("session-1")).toEqual(sample);
    await store.delete("session-1");
    expect(await store.getById("session-1")).toBeNull();
  });
});

describe("B3 — Account-owned store pagination", () => {
  for (const kind of ["memory", "redis"] as const) {
    it(`${kind} lists only the owner, bounds pages and rejects reassignment`, async () => {
      const kv = createFakeKv();
      const store = kind === "memory" ? createMemorySessionStore() : createRedisSessionStore(kv);
      await store.save({ ...sample, id: "a1", ownerAccountId: "account-a" });
      await store.save({ ...sample, id: "a2", ownerAccountId: "account-a" });
      await store.save({ ...sample, id: "b", ownerAccountId: "account-b" });
      await store.save({ ...sample, id: "legacy" });
      const first = await store.listByOwner("account-a", { limit: 1 });
      expect(first.sessions.map((row) => row.id)).toEqual(["a2"]);
      expect(first.nextCursor).toBe("1");
      expect(
        (
          await store.listByOwner("account-a", { cursor: first.nextCursor!, limit: 1 })
        ).sessions.map((row) => row.id),
      ).toEqual(["a1"]);
      await expect(
        store.save({ ...sample, id: "a1", ownerAccountId: "account-b" }),
      ).rejects.toThrow("immutable");
      await store.delete("a2");
      expect((await store.listByOwner("account-a")).sessions.map((row) => row.id)).toEqual(["a1"]);
    });
  }

  it("Redis removes expired index entries without skipping surviving records", async () => {
    const kv = createFakeKv();
    const store = createRedisSessionStore(kv);
    await Promise.all(
      ["a1", "a2", "a3"].map((id) => store.save({ ...sample, id, ownerAccountId: "a" })),
    );
    kv.values.delete("askmeatsack:session:a3"); // Redis's existing TTL removes the record independently.
    const first = await store.listByOwner("a", { limit: 1 });
    expect(first.sessions).toEqual([]);
    const next = await store.listByOwner("a", { limit: 1, cursor: first.nextCursor! });
    expect(next.sessions.map((row) => row.id)).toEqual(["a2"]);
  });
});

describe("B3 — Redis ownership write atomicity", () => {
  it("conflicting concurrent first saves cannot reassign an existing id or index it for a second owner", async () => {
    const store = createRedisSessionStore(createFakeKv());
    const attempts = await Promise.allSettled([
      store.save({ ...sample, id: "same-id", ownerAccountId: "a" }),
      store.save({ ...sample, id: "same-id", ownerAccountId: "b" }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    expect((await store.listByOwner("a")).sessions.map((row) => row.id)).toEqual(["same-id"]);
    expect((await store.listByOwner("b")).sessions).toEqual([]);
  });
});

// C3's source fence is trusted storage authority, not an account/proof HTTP endpoint.
describe("C3 — Ask private-proof source fencing", () => {
  const clockStart = Date.parse(sample.createdAt);
  const lifetimeEnd = Date.parse(sample.expiresAt) + 3_600_000;
  function setup() {
    let time = clockStart;
    return {
      store: createMemorySessionStore(() => new Date(time)),
      advance(to: number) {
        time = to;
      },
    };
  }

  it("refuses public proof, missing and owned records without pinning or changing ownership", async () => {
    const { store } = setup();
    await store.save(sample);
    await store.save({ ...sample, id: "owned", ownerAccountId: "owner" });
    expect(await store.beginClaim(sample.id, "a", "attempt", sample.publicToken)).toBeNull();
    expect(await store.beginClaim("missing", "a", "attempt", sample.agentToken)).toBeNull();
    expect(await store.beginClaim("owned", "a", "attempt", sample.agentToken)).toBeNull();
    await store.save({ ...sample, title: "Still writable" });
    expect((await store.getById(sample.id))?.ownerAccountId).toBeUndefined();
    expect((await store.getById(sample.id))?.title).toBe("Still writable");
    expect((await store.getById("owned"))?.ownerAccountId).toBe("owner");
  });

  it("elects one bound attempt, reconciles its exact snapshot and blocks stale writes/deletes", async () => {
    const { store } = setup();
    await store.save({
      ...sample,
      answers: { q: { selectedOptionIds: [], text: "Original", answeredAt: sample.createdAt } },
    });
    const stale = (await store.getById(sample.id))!;
    const [first, competitor] = await Promise.all([
      store.beginClaim(sample.id, "a", "one", sample.agentToken),
      store.beginClaim(sample.id, "b", "two", sample.agentToken),
    ]);
    expect(first).not.toBeNull();
    expect(competitor).toBeNull();
    expect(await store.beginClaim(sample.id, "a", "one", sample.agentToken)).toEqual(first);
    expect(await store.beginClaim(sample.id, "b", "one", sample.agentToken)).toBeNull();
    expect(await store.beginClaim(sample.id, "a", "different", sample.agentToken)).toBeNull();
    expect(await store.beginClaim(sample.id, "a", "one", "wrong")).toBeNull();
    expect(JSON.parse(first!.snapshot)).toEqual(stale);
    await expect(store.save({ ...stale, title: "Stale edit" })).rejects.toThrow("fenced");
    await expect(store.delete(sample.id)).rejects.toThrow("fenced");
    expect(await store.resolveClaim(sample.id, "b", "one", "aborted")).toBe(false);
    expect(await store.resolveClaim(sample.id, "a", "two", "committed")).toBe(false);
    expect(await store.getById(sample.id)).toEqual(stale);
  });

  it("pins unresolved content past metadata expiry, then abort removes it at the original deadline", async () => {
    const { store, advance } = setup();
    await store.save(sample);
    const first = await store.beginClaim(sample.id, "a", "one", sample.agentToken);
    advance(lifetimeEnd + 60_000);
    expect(await store.beginClaim(sample.id, "a", "one", sample.agentToken)).toEqual(first);
    expect(await store.getById(sample.id)).toEqual(sample);
    expect(await store.resolveClaim(sample.id, "a", "one", "aborted")).toBe(true);
    expect(await store.getById(sample.id)).toBeNull();
    expect(await store.beginClaim(sample.id, "b", "two", sample.agentToken)).toBeNull();
  });

  it("abort restores the original absolute lifetime, without resetting public expiry", async () => {
    const { store, advance } = setup();
    await store.save(sample);
    await store.beginClaim(sample.id, "a", "one", sample.agentToken);
    advance(lifetimeEnd - 500);
    expect(await store.resolveClaim(sample.id, "a", "one", "aborted")).toBe(true);
    expect((await store.getById(sample.id))?.expiresAt).toBe(sample.expiresAt);
    advance(lifetimeEnd);
    expect(await store.getById(sample.id)).toBeNull();
  });

  it("a committed handoff is repeatable only by its binding and cannot resurrect legacy authority", async () => {
    const { store } = setup();
    await store.save(sample);
    await store.beginClaim(sample.id, "a", "one", sample.agentToken);
    expect(await store.resolveClaim(sample.id, "a", "one", "committed")).toBe(true);
    expect(await store.resolveClaim(sample.id, "a", "one", "committed")).toBe(true);
    expect(await store.resolveClaim(sample.id, "a", "one", "aborted")).toBe(false);
    expect(await store.resolveClaim(sample.id, "b", "one", "committed")).toBe(false);
    expect(await store.getById(sample.id)).toBeNull();
    expect(await store.beginClaim(sample.id, "a", "one", sample.agentToken)).toBeNull();
    await expect(store.save(sample)).rejects.toThrow("fenced");
    await expect(store.delete(sample.id)).rejects.toThrow("fenced");
  });

  it("returns canonical snapshots without the owned CAS revision", async () => {
    const { store } = setup();
    await store.save({ ...sample, storageRevision: 4 });
    const result = await store.beginClaim(sample.id, "a", "one", sample.agentToken);
    expect(JSON.parse(result!.snapshot)).toEqual(sample);
  });

  it("Redis uses a single atomic source/fence operation and opaque account-attempt reconciliation", async () => {
    const kv = createFakeKv();
    const run = vi
      .spyOn(kv, "eval")
      .mockResolvedValue(JSON.stringify({ snapshot: JSON.stringify(sample) }));
    const store = createRedisSessionStore(kv);
    expect(await store.beginClaim(sample.id, "a", "one", sample.agentToken)).toEqual({
      snapshot: JSON.stringify(sample),
    });
    const [script, keys, args] = run.mock.calls[0];
    expect(script).toBe(BEGIN_SESSION_CLAIM_LUA);
    expect(keys).toEqual([
      "askmeatsack:session:session-1",
      "askmeatsack:claim:session-1",
      `askmeatsack:claim-abort:session-1:${args[0]}`,
    ]);
    expect(args[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(args.slice(1)).toEqual([sample.agentToken, sample.id]);
    run.mockResolvedValue(1);
    expect(await store.resolveClaim(sample.id, "a", "one", "committed")).toBe(true);
    expect(run.mock.calls[1]).toEqual([RESOLVE_SESSION_CLAIM_LUA, keys, [args[0], "committed"]]);
    await store.resolveClaim(sample.id, "b", "one", "committed");
    expect(run.mock.calls[2][2][0]).not.toBe(args[0]);
    run.mockResolvedValue(false);
    expect(await store.beginClaim(sample.id, "a", "one", "wrong")).toBeNull();
  });

  it("Redis ordinary writes and deletes carry the fence key into their atomic script", async () => {
    const kv = createFakeKv();
    const run = vi.spyOn(kv, "eval").mockRejectedValue(new Error("Session claim is fenced"));
    const store = createRedisSessionStore(kv);
    await expect(store.save(sample)).rejects.toThrow("fenced");
    expect(run.mock.calls[0][0]).toBe(SAVE_OWNED_SESSION_LUA);
    expect(run.mock.calls[0][1].at(-1)).toBe("askmeatsack:claim:session-1");
    await expect(store.delete(sample.id)).rejects.toThrow("fenced");
    expect(run.mock.calls[1]).toEqual([
      DELETE_SESSION_LUA,
      ["askmeatsack:session:session-1", "askmeatsack:claim:session-1"],
      [],
    ]);
  });
});

describe("Ask opaque claim inspection and durable abort barriers", () => {
  it("projects only matching fence state and refuses foreign identities", async () => {
    const store = createMemorySessionStore(() => new Date(sample.createdAt));
    await store.save(sample);
    expect(await store.inspectClaim(sample.id, "a", "one")).toBe("none");
    expect(await store.inspectClaim(sample.id, "", "one")).toBe("foreign");
    await store.beginClaim(sample.id, "a", "one", sample.agentToken);
    expect(await store.inspectClaim(sample.id, "a", "one")).toBe("pending");
    expect(await store.inspectClaim(sample.id, "b", "one")).toBe("foreign");
    expect(await store.inspectClaim(sample.id, "a", "different")).toBe("foreign");
    await store.resolveClaim(sample.id, "a", "one", "committed");
    expect(await store.inspectClaim(sample.id, "a", "one")).toBe("committed");
    expect(await store.inspectClaim(sample.id, "b", "one")).toBe("foreign");
  });
  it("aborts before fence installation and blocks a delayed old attempt after a fresh claim", async () => {
    const store = createMemorySessionStore(() => new Date(sample.createdAt));
    await store.save(sample);
    expect(await store.resolveClaim(sample.id, "a", "old", "committed")).toBe(false);
    expect(await store.resolveClaim(sample.id, "a", "old", "aborted")).toBe(true);
    expect(await store.resolveClaim(sample.id, "a", "old", "aborted")).toBe(true);
    expect(await store.beginClaim(sample.id, "a", "old", sample.agentToken)).toBeNull();
    expect(await store.getById(sample.id)).toEqual(sample);
    expect(await store.beginClaim(sample.id, "b", "fresh", sample.agentToken)).not.toBeNull();
    expect(await store.beginClaim(sample.id, "a", "old", sample.agentToken)).toBeNull();
    expect(await store.resolveClaim(sample.id, "a", "old", "aborted")).toBe(false);
    expect(await store.inspectClaim(sample.id, "b", "fresh")).toBe("pending");
  });
  it("matching abort never lets its old attempt reinstall after a new committed handoff", async () => {
    const store = createMemorySessionStore(() => new Date(sample.createdAt));
    await store.save(sample);
    await store.beginClaim(sample.id, "a", "old", sample.agentToken);
    expect(await store.resolveClaim(sample.id, "a", "old", "aborted")).toBe(true);
    await store.beginClaim(sample.id, "b", "fresh", sample.agentToken);
    expect(await store.beginClaim(sample.id, "a", "old", sample.agentToken)).toBeNull();
    await store.resolveClaim(sample.id, "b", "fresh", "committed");
    expect(await store.beginClaim(sample.id, "a", "old", sample.agentToken)).toBeNull();
    expect(await store.getById(sample.id)).toBeNull();
    expect(await store.inspectClaim(sample.id, "b", "fresh")).toBe("committed");
  });
  it("Redis inspection accepts raw/decoded state only and shares an opaque attempt barrier between abort and begin", async () => {
    const kv = createFakeKv();
    const run = vi.spyOn(kv, "eval");
    const store = createRedisSessionStore(kv);
    for (const state of ["none", "pending", "committed", "foreign"] as const) {
      for (const value of [{ state }, JSON.stringify({ state })]) {
        run.mockResolvedValueOnce(value);
        expect(await store.inspectClaim(sample.id, "a", "old")).toBe(state);
      }
    }
    expect(run.mock.calls[0][0]).toBe(INSPECT_SESSION_CLAIM_LUA);
    expect(run.mock.calls[0][1]).toEqual(["askmeatsack:claim:session-1"]);
    expect(run.mock.calls[0][2][0]).toMatch(/^[a-f0-9]{64}$/);
    run.mockResolvedValueOnce({ snapshot: "private-proof" });
    await expect(store.inspectClaim(sample.id, "a", "old")).rejects.toThrow(
      "Invalid claim inspection",
    );
    run.mockResolvedValueOnce(1);
    expect(await store.resolveClaim(sample.id, "a", "old", "aborted")).toBe(true);
    const abort = run.mock.calls.at(-1)!;
    run.mockResolvedValueOnce(false);
    expect(await store.beginClaim(sample.id, "a", "old", sample.agentToken)).toBeNull();
    const begin = run.mock.calls.at(-1)!;
    expect(abort[1][2]).toBe(begin[1][2]);
    expect(abort[1][2]).not.toContain(sample.agentToken);
    expect(abort[1][2]).toMatch(/^askmeatsack:claim-abort:session-1:[a-f0-9]{64}$/);
  });
});
