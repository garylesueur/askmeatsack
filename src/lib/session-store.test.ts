import { describe, expect, it } from "vitest";
import {
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
