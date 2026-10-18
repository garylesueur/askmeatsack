import { describe, expect, it, vi } from "vitest";
import { createOwnedSessionStore } from "./owned-session-store";
import {
  OwnedSessionError,
  type AskMetadata,
  type AskMetadataOperation,
  type OwnedEnvelope,
} from "./owned-session-metadata";
import { createMemorySessionStore, type Session, type SessionStore } from "./session-store";

function fixture() {
  const legacy = createMemorySessionStore(() => new Date("2026-10-11T09:00:00Z"));
  const session: Session = {
    id: "legacy-request",
    createdAt: "2026-10-11T08:00:00Z",
    expiresAt: "2026-10-11T10:00:00Z",
    status: "pending",
    questions: [],
    answers: {},
    publicToken: "public-token",
    agentToken: "private-proof",
  };
  let overlay: OwnedEnvelope | { retired: true } | null = null;
  const read = vi.fn(async () => overlay);
  const metadata: AskMetadata = {
    async call<T>(operation: AskMetadataOperation) {
      if (operation !== "getById") throw new Error("Unexpected durable write");
      return (await read()) as T;
    },
  };
  const store = createOwnedSessionStore(legacy, metadata);
  return {
    store,
    legacy,
    session,
    read,
    publish() {
      overlay = {
        session: JSON.stringify({ ...session, ownerAccountId: "account-a" }),
        revision: 0,
      };
    },
    retire() {
      overlay = { retired: true };
    },
  };
}

describe("Owned Ask source claims", () => {
  it("forwards an unowned source fence while normal stale writes remain immutable", async () => {
    const f = fixture();
    await f.legacy.save(f.session);
    const snapshot = await f.store.beginClaim!(
      f.session.id,
      "account-a",
      "attempt",
      f.session.agentToken,
    );
    expect(snapshot).toEqual({ snapshot: JSON.stringify(f.session) });
    expect(
      await f.store.beginClaim!(f.session.id, "account-b", "other", f.session.agentToken),
    ).toBeNull();
    await expect(f.store.save({ ...f.session, ownerAccountId: "account-a" })).rejects.toThrow(
      "fenced",
    );
    await expect(f.store.delete(f.session.id)).rejects.toThrow("fenced");
    expect(await f.store.getById(f.session.id)).toEqual(f.session);
    expect(await f.store.resolveClaim!(f.session.id, "account-b", "attempt", "aborted")).toBe(
      false,
    );
    expect(await f.store.resolveClaim!(f.session.id, "account-a", "attempt", "aborted")).toBe(true);
    await expect(f.store.save({ ...f.session, ownerAccountId: "account-a" })).rejects.toThrow(
      "immutable",
    );
  });

  it.each(["live", "retired"])(
    "refuses a %s durable overlay before fencing legacy authority",
    async (kind) => {
      const f = fixture();
      await f.legacy.save(f.session);
      const begin = vi.spyOn(f.legacy, "beginClaim");
      // Construct after spying because capabilities are bound once to the selected source.
      const store = createOwnedSessionStore(f.legacy, {
        async call<T>() {
          return (kind === "retired" ? { retired: true } : { session: "{}", revision: 0 }) as T;
        },
      });
      expect(
        await store.beginClaim!(f.session.id, "account-a", "attempt", f.session.agentToken),
      ).toBeNull();
      expect(begin).not.toHaveBeenCalled();
      await f.legacy.save({ ...f.session, title: "still writable" });
    },
  );

  it("fails closed when durable authority is unavailable without pinning a source", async () => {
    const f = fixture();
    await f.legacy.save(f.session);
    f.read.mockRejectedValueOnce(new OwnedSessionError("storage_unavailable"));
    await expect(
      f.store.beginClaim!(f.session.id, "account-a", "attempt", f.session.agentToken),
    ).rejects.toMatchObject({ code: "storage_unavailable" });
    const missing = createOwnedSessionStore(f.legacy, null);
    await expect(
      missing.beginClaim!(f.session.id, "account-a", "attempt", f.session.agentToken),
    ).rejects.toMatchObject({ code: "storage_unavailable" });
    await f.legacy.delete(f.session.id);
  });

  it("lets trusted reconciliation retire a fenced source after durable publication", async () => {
    const f = fixture();
    await f.legacy.save(f.session);
    await f.store.beginClaim!(f.session.id, "account-a", "attempt", f.session.agentToken);
    f.publish();
    expect(await f.store.getById(f.session.id)).toMatchObject({
      ownerAccountId: "account-a",
      storageRevision: 0,
    });
    const reads = f.read.mock.calls.length;
    expect(await f.store.resolveClaim!(f.session.id, "account-a", "attempt", "committed")).toBe(
      true,
    );
    expect(f.read.mock.calls.length).toBe(reads);
    expect(await f.legacy.getById(f.session.id)).toBeNull();
    expect(await f.store.resolveClaim!(f.session.id, "account-a", "attempt", "committed")).toBe(
      true,
    );
    await expect(f.legacy.save(f.session)).rejects.toThrow("fenced");
    f.retire();
    expect(await f.store.getById(f.session.id)).toBeNull();
  });

  it("never bypasses private proof validation through unowned fallback", async () => {
    const f = fixture();
    await f.legacy.save(f.session);
    expect(
      await f.store.beginClaim!(f.session.id, "account-a", "attempt", f.session.publicToken),
    ).toBeNull();
    expect(
      await f.store.beginClaim!("missing", "account-a", "attempt", f.session.agentToken),
    ).toBeNull();
    await f.legacy.delete(f.session.id);
  });

  it("does not advertise a partial source capability", () => {
    const f = fixture();
    const { resolveClaim: _resolve, ...partial } = f.legacy;
    const store = createOwnedSessionStore(partial as SessionStore, null);
    expect(store.beginClaim).toBeUndefined();
    expect(store.resolveClaim).toBeUndefined();
  });
});

it("inspection follows only the legacy fence even after live/retired durable overlays appear", async () => {
  const f = fixture();
  await f.legacy.save(f.session);
  expect(await f.store.inspectClaim!(f.session.id, "account-a", "attempt")).toBe("none");
  await f.store.beginClaim!(f.session.id, "account-a", "attempt", f.session.agentToken);
  expect(await f.store.inspectClaim!(f.session.id, "account-a", "attempt")).toBe("pending");
  f.read.mockResolvedValue({ retired: true });
  expect(await f.store.inspectClaim!(f.session.id, "account-a", "attempt")).toBe("pending");
  expect(await f.store.resolveClaim!(f.session.id, "account-a", "attempt", "committed")).toBe(true);
  expect(await f.store.inspectClaim!(f.session.id, "account-a", "attempt")).toBe("committed");
});
it("partial inspection capability never advertises an incomplete claim protocol", () => {
  const f = fixture();
  const { inspectClaim: _inspect, ...partial } = f.legacy;
  const store = createOwnedSessionStore(partial, { call: async () => null } as AskMetadata);
  expect(store.beginClaim).toBeUndefined();
  expect(store.resolveClaim).toBeUndefined();
  expect(store.inspectClaim).toBeUndefined();
});
