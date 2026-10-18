import { describe, expect, it } from "vitest";
import { createMemorySessionStore } from "./session-store";
import { createSessionService, isSessionServiceError } from "./sessions";
import { createAskmeatsackTool } from "./askmeatsack-tool";

const questions = [{ id: "q", prompt: "Your answer?", allowText: true, required: false }];
function fixture() {
  let now = new Date("2026-10-07T10:00:00Z");
  let id = 0;
  const store = createMemorySessionStore();
  const service = createSessionService({
    store,
    now: () => now,
    createId: () => `session-${++id}`,
    createToken: () => `private-token-${id}-${Math.random()}`,
    publicBaseUrl: "https://ask.imeatsack.com",
    sleep: async () => {},
    postCallback: async () => {},
  });
  return {
    store,
    service,
    setNow: (date: Date) => {
      now = date;
    },
  };
}

describe("Workspace B3 — Verified owner records foundation", () => {
  it("attributes HTTP/service and MCP creates to trusted authority, ignores body ownership and preserves anonymous creates", async () => {
    const { store, service } = fixture();
    await service.create(
      { questions, ownerAccountId: "victim", metadata: { ownerAccountId: "victim" } },
      { account: "a" },
    );
    await createAskmeatsackTool(service, { account: "b" }).invoke({
      action: "create",
      questions,
      metadata: { ownerAccountId: "a" },
    });
    await service.create({ questions, ownerAccountId: "a" });
    expect((await store.getById("session-1"))?.ownerAccountId).toBe("a");
    expect((await store.getById("session-2"))?.ownerAccountId).toBe("b");
    expect((await store.getById("session-3"))?.ownerAccountId).toBeUndefined();
    expect((await ownedPage(service, "a")).records.map((record) => record.id)).toEqual([
      "session-1",
    ]);
    expect((await ownedPage(service, "b")).records.map((record) => record.id)).toEqual([
      "session-2",
    ]);
    await Promise.all(
      ["b", "unknown"].map(async (account) => {
        expect(await service.getForOwner({ account, sessionId: "session-1" })).toMatchObject({
          status: 404,
        });
        expect(await service.cancelForOwner({ account, sessionId: "session-1" })).toMatchObject({
          status: 404,
        });
      }),
    );
    expect((await store.getById("session-1"))?.status).toBe("pending");
    expect(await service.cancelForOwner({ account: "a", sessionId: "session-1" })).toMatchObject({
      status: "cancelled",
    });
    expect((await store.getById("session-1"))?.ownerAccountId).toBe("a");
  });

  it("never returns manage/public tokens or token-bearing file URLs in owner summaries and detail", async () => {
    const { service, store } = fixture();
    await service.create({ questions }, { account: "a" });
    const session = (await store.getById("session-1"))!;
    session.answers.q = {
      selectedOptionIds: [],
      text: "Retained answer",
      answeredAt: session.createdAt,
      files: [
        {
          id: "f",
          questionId: "q",
          filename: "document.pdf",
          contentType: "application/pdf",
          size: 123,
          url: `https://ask.imeatsack.com/file?t=${session.publicToken}`,
          key: "private-r2-key",
        },
      ],
    };
    await store.save(session);
    const detail = await service.getForOwner({ account: "a", sessionId: session.id });
    expect(detail).toMatchObject({
      answers: { q: { text: "Retained answer", files: [{ filename: "document.pdf" }] } },
    });
    for (const response of [detail, await service.listForOwner({ account: "a" })]) {
      const json = JSON.stringify(response);
      expect(json).not.toContain(session.publicToken);
      expect(json).not.toContain(session.agentToken);
      expect(json).not.toContain("private-r2-key");
      expect(json).not.toContain("answerUrl");
      expect(json).not.toContain("manageUrl");
    }
  });

  it("keeps cancellation freezes and the current terminal read window rather than promising durable retention", async () => {
    const { service, store, setNow } = fixture();
    await service.create({ questions }, { account: "a" });
    const session = (await store.getById("session-1"))!;
    await store.save({ ...session, status: "submitted", submittedAt: "2026-10-07T10:00:00Z" });
    expect(await service.cancelForOwner({ account: "a", sessionId: session.id })).toMatchObject({
      status: 409,
    });
    setNow(new Date("2026-10-07T11:00:00Z"));
    expect(await service.getForOwner({ account: "a", sessionId: session.id })).toMatchObject({
      status: 404,
    });
    expect((await ownedPage(service, "a")).records).toEqual([]);
  });
});

async function ownedPage(service: ReturnType<typeof createSessionService>, account: string) {
  const result = await service.listForOwner({ account });
  if (isSessionServiceError(result)) throw new Error(result.message);
  return result;
}
