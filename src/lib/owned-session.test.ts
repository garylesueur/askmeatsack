import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createMemorySessionStore, type Session } from "./session-store";
import { createOwnedSessionStore } from "./owned-session-store";
import {
  createAskMetadata,
  OwnedSessionError,
  type AskMetadata,
  type AskMetadataOperation,
  type OwnedEnvelope,
} from "./owned-session-metadata";
import { createSessionService, isSessionServiceError } from "./sessions";
import {
  canonicalSessionBytes,
  ownedCompletionBytes,
  ownedSessionFits,
} from "./owned-session-capacity";

function fixture() {
  let now = Date.parse("2026-10-11T09:00:00Z");
  let id = 0;
  const canonical = new Map<string, OwnedEnvelope & { fingerprint: string }>();
  const retired = new Set<string>();
  const calls: { operation: string; input: Record<string, unknown> }[] = [];
  const legacy = createMemorySessionStore();
  const metadata: AskMetadata = {
    async call<T>(operation: AskMetadataOperation, input: Record<string, unknown>) {
      calls.push({ operation, input });
      let result: unknown;
      if (operation === "create") {
        const parsed = JSON.parse(String(input.session)) as Session;
        const old = canonical.get(parsed.id);
        if (old && old.fingerprint !== input.fingerprint)
          throw new OwnedSessionError("conflict", 409);
        if (retired.has(parsed.id)) throw new OwnedSessionError("conflict", 409);
        result = old ?? {
          session: String(input.session),
          revision: 0,
          fingerprint: String(input.fingerprint),
        };
        canonical.set(parsed.id, result as OwnedEnvelope & { fingerprint: string });
      } else if (operation === "getById")
        result = retired.has(String(input.id))
          ? { retired: true }
          : (canonical.get(String(input.id)) ?? null);
      else if (operation === "compareAndSave") {
        const old = canonical.get(String(input.id));
        result =
          old && old.revision === input.expectedRevision
            ? { ...old, session: String(input.session), revision: old.revision + 1 }
            : null;
        if (result)
          canonical.set(String(input.id), result as OwnedEnvelope & { fingerprint: string });
      } else if (operation === "fileAccess")
        result = {
          fileIds: ["file"],
          files: {
            file: {
              state: "sealed",
              scanStatus: "clean",
              uploadedAt: new Date(now).toISOString(),
              retainedUntil: new Date(now + 86400000).toISOString(),
            },
          },
          keptFiles: {},
        };
      else if (operation === "delete") {
        canonical.delete(String(input.id));
        retired.add(String(input.id));
        result = { removed: true, cleanupPending: false };
      } else if (operation === "recordShare") result = { recorded: true };
      else if (operation === "allowance")
        result = { requests: canonical.size, requestLimit: 500, bytes: 0, byteLimit: 1000000000 };
      else if (operation === "listByOwner") result = { records: [], nextCursor: null };
      return result as T;
    },
  };
  const store = createOwnedSessionStore(legacy, metadata);
  const callback = vi.fn(async () => {});
  const service = createSessionService({
    store,
    metadata,
    now: () => new Date(now),
    createId: () => `request-${++id}`,
    createToken: () => `token-${++id}`,
    publicBaseUrl: "https://ask.imeatsack.com",
    sleep: async () => {},
    postCallback: callback,
  });
  return {
    service,
    store,
    legacy,
    metadata,
    calls,
    canonical,
    retired,
    callback,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
const questions = [{ id: "q", prompt: "Your answer?", required: false }];
async function requiredSession(
  value: Awaited<ReturnType<ReturnType<typeof createSessionService>["create"]>>,
  store: ReturnType<typeof createOwnedSessionStore>,
) {
  if (isSessionServiceError(value)) throw new Error(value.message);
  const session = await store.getById(value.sessionId);
  if (!session) throw new Error("missing session");
  return session;
}

describe("Owned Ask storage and authority", () => {
  it("stable creation retries preserve first tokens/times and refuse changed content", async () => {
    const f = fixture();
    const first = await f.service.create({ questions }, { account: "a", idempotencyKey: "retry" });
    f.advance(60000);
    expect(
      await f.service.create({ questions }, { account: "a", idempotencyKey: "retry" }),
    ).toEqual(first);
    expect(f.canonical.size).toBe(1);
    expect(
      await f.service.create(
        { questions, title: "changed" },
        { account: "a", idempotencyKey: "retry" },
      ),
    ).toMatchObject({ code: "conflict", status: 409 });
    await f.service.create({ questions }, { account: "b", idempotencyKey: "retry" });
    expect(f.canonical.size).toBe(2);
  });
  it("preserves anonymous creation and fails closed for a new owner without metadata", async () => {
    const legacy = createMemorySessionStore();
    const store = createOwnedSessionStore(legacy, null);
    const f = fixture();
    const service = createSessionService({
      store,
      now: () => new Date(),
      createId: () => "anonymous",
      createToken: () => "token",
      publicBaseUrl: "https://ask.imeatsack.com",
      sleep: async () => {},
      postCallback: async () => {},
    });
    expect(await service.create({ questions })).toMatchObject({ sessionId: "anonymous" });
    expect(await service.create({ questions }, { account: "a" })).toMatchObject({
      code: "storage_unavailable",
      status: 503,
    });
    expect(await f.legacy.getById("anonymous")).toBeNull();
  });
  it("CAS never overwrites concurrent answers and strips internal revision from the wire", async () => {
    const f = fixture();
    const session = await requiredSession(
      await f.service.create({ questions }, { account: "a" }),
      f.store,
    );
    const stale = structuredClone(session);
    session.answers.q = { selectedOptionIds: [], text: "first", answeredAt: session.createdAt };
    await f.store.save(session);
    stale.answers.q = { selectedOptionIds: [], text: "stale", answeredAt: session.createdAt };
    await expect(f.store.save(stale)).rejects.toMatchObject({ code: "conflict", status: 409 });
    expect(JSON.parse(f.canonical.get(session.id)!.session).answers.q.text).toBe("first");
    const write = f.calls.find((c) => c.operation === "compareAndSave")!;
    expect(write.input).not.toHaveProperty("before");
    expect(String(write.input.session)).not.toContain("storageRevision");
  });
  it("retirement never falls back to a legacy row with the same ID", async () => {
    const f = fixture();
    const session = await requiredSession(
      await f.service.create({ questions }, { account: "a" }),
      f.store,
    );
    await f.legacy.save({ ...session, storageRevision: undefined });
    expect(await f.service.removeForOwner({ account: "b", sessionId: session.id })).toMatchObject({
      status: 404,
    });
    expect(await f.service.removeForOwner({ account: "a", sessionId: session.id })).toMatchObject({
      removed: true,
    });
    expect(await f.store.getById(session.id)).toBeNull();
  });
  it("separates persistent owner, original public expiry and one-hour terminal agent powers", async () => {
    const f = fixture();
    const session = await requiredSession(
      await f.service.create({ questions, expiresInSeconds: 14400 }, { account: "a" }),
      f.store,
    );
    await f.service.saveAnswer({
      sessionId: session.id,
      publicToken: session.publicToken,
      questionId: "q",
      body: { text: "answer" },
    });
    await f.service.submit({ sessionId: session.id, publicToken: session.publicToken });
    f.advance(2 * 3600000);
    expect(
      await f.service.getForAgent({
        sessionId: session.id,
        agentToken: session.agentToken,
        hasCreateCredential: false,
      }),
    ).toMatchObject({ status: 404 });
    expect(
      await f.service.getForPublic({ sessionId: session.id, publicToken: session.publicToken }),
    ).toMatchObject({ status: "submitted" });
    expect(await f.service.getForOwner({ account: "a", sessionId: session.id })).toMatchObject({
      status: "submitted",
    });
    expect(await f.service.getForOwner({ account: "b", sessionId: session.id })).toMatchObject({
      status: 404,
    });
    f.advance(3 * 3600000);
    expect(
      await f.service.getForPublic({ sessionId: session.id, publicToken: session.publicToken }),
    ).toMatchObject({ status: 404 });
    expect(
      await f.service.downloadForOwner({ account: "a", sessionId: session.id, format: "json" }),
    ).toMatchObject({ status: "submitted" });
    expect(await f.store.getById(session.id)).not.toBeNull();
  });
  it("attempts an unsent terminal callback even when expiry was committed by cron", async () => {
    const f = fixture();
    const session = await requiredSession(
      await f.service.create(
        { questions, callbackUrl: "https://example.com/callback" },
        { account: "a" },
      ),
      f.store,
    );
    session.status = "expired";
    await f.store.save(session);
    await f.service.getForOwner({ account: "a", sessionId: session.id });
    await f.service.getForOwner({ account: "a", sessionId: session.id });
    expect(f.callback).toHaveBeenCalledTimes(1);
  });
  it("normalizes owned option selections as a set and refuses foreign edit/export/file reads", async () => {
    const f = fixture();
    const session = await requiredSession(
      await f.service.create(
        {
          questions: [
            {
              id: "q",
              prompt: "Choose",
              options: [
                { id: "a", label: "A" },
                { id: "b", label: "B" },
              ],
              allowMultiple: true,
            },
          ],
        },
        { account: "a" },
      ),
      f.store,
    );
    await f.service.saveAnswer({
      sessionId: session.id,
      publicToken: session.publicToken,
      questionId: "q",
      body: { selectedOptionIds: ["a", "a"] },
    });
    expect((await f.store.getById(session.id))?.answers.q.selectedOptionIds).toEqual(["a"]);
    expect(
      await f.service.updateForOwner({
        account: "b",
        sessionId: session.id,
        body: { title: "forged" },
      }),
    ).toMatchObject({ status: 404 });
    expect(
      await f.service.downloadForOwner({ account: "b", sessionId: session.id, format: "json" }),
    ).toMatchObject({ status: 404 });
    expect(
      await f.service.readFileForOwner({ account: "b", sessionId: session.id, fileId: "file" }),
    ).toMatchObject({ status: 404 });
  });
});

describe("Completion capacity", () => {
  it("admits hundreds of normal questions without a count limit and rejects predictable overflow", () => {
    const base = {
      questions: Array.from({ length: 300 }, (_, i) => ({ id: `q${i}`, prompt: "Answer" })),
      answers: {},
    };
    expect(ownedSessionFits(base)).toBe(true);
    expect(
      ownedSessionFits({
        ...base,
        questions: Array.from({ length: 400 }, (_, i) => ({ id: `q${i}`, prompt: "Answer" })),
      }),
    ).toBe(false);
    expect(
      ownedSessionFits({
        ...base,
        questions: Array.from({ length: 30 }, (_, i) => ({
          id: `q${i}`,
          prompt: "Answer",
          allowFiles: true,
        })),
      }),
    ).toBe(false);
  });
  it("covers allowed escaped Unicode IDs, comments, entries and normal descriptor duplication", () => {
    const q = {
      id: "__proto__",
      prompt: "Answer",
      allowFiles: true,
      allowMultiple: true,
      options: [{ id: "雪雪" }, { id: "abc" }],
      fields: [{ id: "constructor" }],
    };
    const base = { questions: [q], answers: {}, storageRevision: 999 };
    const normal = {
      ...base,
      answers: JSON.parse(
        '{"__proto__":{"selectedOptionIds":["雪雪","abc"],"text":"hello","entries":{"constructor":"answer"},"answeredAt":"2026-10-11T09:00:00.000Z"}}',
      ),
    };
    expect(ownedCompletionBytes(base)).toBeGreaterThan(canonicalSessionBytes(normal));
    expect(canonicalSessionBytes({ ...normal, storageRevision: 1 })).toBe(
      canonicalSessionBytes({ ...normal, storageRevision: 2 }),
    );
  });
});

describe("Signed Ask metadata transport", () => {
  it("uses distinct HMAC purpose, fixed endpoint and no-cache/no-redirect requests", async () => {
    const send = vi.fn<typeof fetch>(async (_url, init) => {
      const body = String(init?.body);
      const signature = createHmac("sha256", "ask-only")
        .update(`1000.askmeatsack-account-store.${body}`)
        .digest("hex");
      expect(new Headers(init?.headers).get("ask-store-signature")).toBe(`t=1000,v1=${signature}`);
      expect(init).toMatchObject({ cache: "no-store", redirect: "error" });
      return Response.json(null);
    });
    await createAskMetadata({
      url: "https://meatsack.puregaz.com/wrong",
      secret: "ask-only",
      fetch: send,
      now: () => 1000000,
    }).call("getById", { id: "request" });
    expect(String(send.mock.calls[0][0])).toBe("https://meatsack.puregaz.com/api/v1/asks/store");
  });
  it("reports capacity truthfully and refuses malformed/network authority responses", async () => {
    const send = vi.fn<typeof fetch>();
    const client = createAskMetadata({ url: "https://example.com", secret: "secret", fetch: send });
    send.mockResolvedValueOnce(Response.json({ error: "canonical_too_large" }, { status: 413 }));
    await expect(client.call("create", {})).rejects.toMatchObject({
      code: "canonical_too_large",
      status: 413,
    });
    send.mockResolvedValueOnce(new Response("bad-json"));
    await expect(client.call("getById", {})).rejects.toMatchObject({ code: "storage_unavailable" });
    send.mockRejectedValueOnce(new Error("network"));
    await expect(client.call("getById", {})).rejects.toMatchObject({ code: "storage_unavailable" });
  });
});

it("owner detail/export/public DTOs strip private keys and owner download links require the portal", async () => {
  const f = fixture();
  const session = await requiredSession(
    await f.service.create({ questions }, { account: "a" }),
    f.store,
  );
  const file = {
    id: "file",
    questionId: "q",
    filename: "answer.txt",
    contentType: "text/plain",
    size: 3,
    key: "askmeatsack/owned/private-key",
    url: `https://ask.imeatsack.com/files?t=${session.publicToken}`,
    uploadedAt: session.createdAt,
    retainedUntil: session.expiresAt,
  };
  session.uploads = { file };
  session.answers.q = {
    selectedOptionIds: [],
    text: "answer",
    files: [file],
    answeredAt: session.createdAt,
  };
  session.status = "submitted";
  session.submittedAt = session.createdAt;
  await f.store.save(session);
  const detail = await f.service.getForOwner({ account: "a", sessionId: session.id });
  expect(JSON.stringify(detail)).not.toContain("private-key");
  expect(JSON.stringify(detail)).not.toContain(session.agentToken);
  expect(detail).toMatchObject({
    files: [{ canRead: true, canKeep: true, canRetryScan: false, name: "answer.txt" }],
  });
  const exported = await f.service.downloadForOwner({
    account: "a",
    sessionId: session.id,
    format: "json",
  });
  expect(JSON.stringify(exported)).not.toContain(session.publicToken);
  expect(JSON.stringify(exported)).not.toContain("private-key");
  expect(JSON.stringify(exported)).toContain("/api/portal/askmeatsack/records/");
  expect(
    JSON.stringify(
      await f.service.getForPublic({ sessionId: session.id, publicToken: session.publicToken }),
    ),
  ).not.toContain("private-key");
});

it("owner mutations use the actual safe detail projection", async () => {
  const f = fixture();
  const session = await requiredSession(
    await f.service.create({ questions, title: "Request title" }, { account: "a" }),
    f.store,
  );
  const record = await f.service.getForOwner({ account: "a", sessionId: session.id });
  const updated = await f.service.updateForOwner({
    account: "a",
    sessionId: session.id,
    body: { title: "Updated title" },
  });
  expect(updated).toEqual(await f.service.getForOwner({ account: "a", sessionId: session.id }));
  const cancelled = await f.service.cancelForOwner({ account: "a", sessionId: session.id });
  expect(cancelled).toEqual(await f.service.getForOwner({ account: "a", sessionId: session.id }));
  for (const dto of [record, updated, cancelled]) {
    expect(JSON.stringify(dto)).not.toContain(session.agentToken);
    expect(dto).not.toHaveProperty("manageUrl");
    expect(dto).not.toHaveProperty("pollUrl");
  }
});

it("preserves arbitrary own question/entry IDs through partial saves, bulk saves, progress and submit", async () => {
  const f = fixture();
  const session = await requiredSession(
    await f.service.create(
      {
        questions: [
          {
            id: "constructor",
            prompt: "Choose",
            options: [
              { id: "constructor", label: "First" },
              { id: "__proto__", label: "Second" },
            ],
          },
          {
            id: "__proto__",
            prompt: "Enter both",
            fields: [
              { id: "constructor", label: "First" },
              { id: "__proto__", label: "Second" },
            ],
          },
        ],
      },
      { account: "a" },
    ),
    f.store,
  );
  expect(await f.service.getForOwner({ account: "a", sessionId: session.id })).toMatchObject({
    progress: { answeredCount: 0, requiredAnsweredCount: 0 },
  });
  expect(
    await f.service.markdownForManage({
      sessionId: session.id,
      agentToken: session.agentToken,
      hasCreateCredential: false,
    }),
  ).toBeTypeOf("string");
  expect(
    await f.service.saveAnswer({
      sessionId: session.id,
      publicToken: session.publicToken,
      questionId: "__proto__",
      body: { entries: { constructor: "first" } },
    }),
  ).toMatchObject({ progress: { answeredCount: 0 } });
  expect(
    await f.service.submit({ sessionId: session.id, publicToken: session.publicToken }),
  ).toMatchObject({ code: "required_unanswered", status: 400 });
  const body = JSON.parse(
    '{"answers":{"constructor":{"selectedOptionIds":["__proto__"]},"__proto__":{"entries":{"constructor":"first","__proto__":"second"}}}}',
  );
  expect(
    await f.service.saveAnswers({ sessionId: session.id, publicToken: session.publicToken, body }),
  ).toMatchObject({ progress: { answeredCount: 2, requiredAnsweredCount: 2 } });
  const stored = (await f.store.getById(session.id))!;
  expect(Object.hasOwn(stored.answers, "constructor")).toBe(true);
  expect(Object.hasOwn(stored.answers, "__proto__")).toBe(true);
  expect(Object.hasOwn(stored.answers.__proto__.entries!, "__proto__")).toBe(true);
  expect(stored.answers.__proto__.entries!.__proto__).toBe("second");
  expect(
    await f.service.submit({ sessionId: session.id, publicToken: session.publicToken }),
  ).toMatchObject({ status: "submitted" });
  expect(
    await f.service.downloadForOwner({ account: "a", sessionId: session.id, format: "markdown" }),
  ).toContain("Second: second");
});

it.each(["recovery_busy", "keep_retry_required"])(
  "passes authoritative %s without generic failure",
  async (code) => {
    const send = vi.fn<typeof fetch>();
    const client = createAskMetadata({
      url: "https://example.com",
      secret: "synthetic",
      fetch: send,
    });
    send.mockResolvedValueOnce(Response.json({ error: code }, { status: 409 }));
    await expect(client.call("beginKeep", {})).rejects.toMatchObject({ code, status: 409 });
  },
);

it("all owned outward answer projections strip sealed keys while canonical storage retains them", async () => {
  const f = fixture();
  async function answered() {
    const session = await requiredSession(
      await f.service.create(
        { questions: [{ ...questions[0], allowFiles: true }] },
        { account: "a" },
      ),
      f.store,
    );
    const file = {
      id: "file",
      questionId: "q",
      filename: "answer.txt",
      contentType: "text/plain",
      size: 3,
      key: "askmeatsack/owned/private-sealed-key",
      url: `https://ask.imeatsack.com/file?t=${session.publicToken}`,
      uploadedAt: session.createdAt,
      retainedUntil: session.expiresAt,
    };
    session.uploads = { file };
    session.answers.q = {
      selectedOptionIds: [],
      text: "answer",
      files: [file],
      answeredAt: session.createdAt,
    };
    session.status = "in_progress";
    await f.store.save(session);
    return session;
  }
  const submitted = await answered();
  const firstSubmit = await f.service.submit({
    sessionId: submitted.id,
    publicToken: submitted.publicToken,
  });
  const repeatedSubmit = await f.service.submit({
    sessionId: submitted.id,
    publicToken: submitted.publicToken,
  });
  const exported = await f.service.downloadForPublic({
    sessionId: submitted.id,
    publicToken: submitted.publicToken,
  });
  const agent = await f.service.getForAgent({
    sessionId: submitted.id,
    agentToken: submitted.agentToken,
    hasCreateCredential: false,
  });
  for (const dto of [firstSubmit, repeatedSubmit, exported, agent])
    expect(JSON.stringify(dto)).not.toContain("private-sealed-key");
  expect(JSON.stringify(exported)).toContain("answer.txt");
  expect((await f.store.getById(submitted.id))?.uploads?.file.key).toContain("private-sealed-key");
  const cancelled = await answered();
  const firstCancel = await f.service.cancel({
    sessionId: cancelled.id,
    publicToken: cancelled.publicToken,
    hasCreateCredential: false,
  });
  const repeatedCancel = await f.service.cancel({
    sessionId: cancelled.id,
    agentToken: cancelled.agentToken,
    hasCreateCredential: false,
  });
  for (const dto of [firstCancel, repeatedCancel])
    expect(JSON.stringify(dto)).not.toContain("private-sealed-key");
});

it("delegates canonical owner observations to native receipt authority and recovers a committed retry after link closure", async () => {
  const f = fixture();
  const created = await f.service.create(
    { questions },
    { account: "a", idempotencyKey: "sharing" },
  );
  if (isSessionServiceError(created)) throw new Error(created.message);
  const session = await f.store.getById(created.sessionId);
  const native = f.metadata.call.bind(f.metadata);
  vi.spyOn(f.metadata, "call").mockImplementation((operation, input) =>
    operation === "recordShare" && input.accountId === "b"
      ? Promise.resolve(null)
      : native(operation, input),
  );
  const input = {
    sessionId: created.sessionId,
    attemptId: "copy-attempt",
    answerUrl: created.answerUrl,
    kind: "copied" as const,
  };
  expect(await f.service.recordSharingForOwner({ ...input, account: "b" })).toMatchObject({
    status: 404,
  });
  expect(
    await f.service.recordSharingForOwner({
      ...input,
      account: "a",
      answerUrl: "https://evil.example/s/request?t=public",
    }),
  ).toMatchObject({ status: 409 });
  expect(f.calls.filter((call) => call.operation === "recordShare")).toHaveLength(0);
  expect(await f.service.recordSharingForOwner({ ...input, account: "a" })).toEqual({
    recorded: true,
  });
  expect(f.calls.filter((call) => call.operation === "recordShare")).toEqual([
    {
      operation: "recordShare",
      input: {
        id: created.sessionId,
        accountId: "a",
        publicToken: session!.publicToken,
        attemptId: "copy-attempt",
        kind: "copied",
      },
    },
  ]);
  await f.service.cancelForOwner({ account: "a", sessionId: created.sessionId });
  expect(await f.service.recordSharingForOwner({ ...input, account: "a" })).toEqual({
    recorded: true,
  });
  expect(f.calls.filter((call) => call.operation === "recordShare")).toHaveLength(2);
});
