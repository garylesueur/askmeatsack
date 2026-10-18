import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as listRecords } from "./route";
import { GET as getRecord, PATCH as editRecord } from "./[recordId]/route";
import { POST as cancelRecord } from "./[recordId]/cancel/route";
import { POST as createSession } from "@/app/api/v1/sessions/route";
import { POST as mcpPost } from "@/app/mcp/route";
import { createMemorySessionStore, type SessionStore } from "@/lib/session-store";

const state = globalThis as typeof globalThis & { askmeatsackStore?: SessionStore };
const questions = [{ id: "q", prompt: "Your answer?", allowText: true }];
const verifiedFetch = vi.fn<typeof fetch>();
let previousStore: SessionStore | undefined;

beforeEach(() => {
  previousStore = state.askmeatsackStore;
  state.askmeatsackStore = createMemorySessionStore();
  vi.stubGlobal("fetch", verifiedFetch);
  verifiedFetch.mockReset();
  verifiedFetch.mockImplementation(async (_url, options) => {
    const input = JSON.parse(String(options?.body));
    if (input.token === "token-a") return Response.json({ account: "a" });
    if (input.token === "token-b") return Response.json({ account: "b" });
    return Response.json({ error: "refused" }, { status: 401 });
  });
});
afterEach(() => {
  state.askmeatsackStore = previousStore;
  vi.unstubAllGlobals();
});

function request(path: string, token?: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: token === undefined ? {} : { authorization: token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function detailContext(id: string) {
  return { params: Promise.resolve({ recordId: id }) };
}

async function create(token?: string) {
  const response = await createSession(
    request("/api/v1/sessions", token, {
      questions,
      ownerAccountId: "b",
      metadata: { ownerAccountId: "b" },
    }),
  );
  expect(response.status).toBe(201);
  return (await response.json()).sessionId as string;
}

describe("Workspace B3 — HTTP account authority boundary", () => {
  it("attributes only verified create headers, scopes list/detail/cancel, and never returns capabilities", async () => {
    const a = await create("Bearer token-a");
    const b = await create("Bearer token-b");
    const anonymous = await create();
    expect((await state.askmeatsackStore!.getById(a))?.ownerAccountId).toBe("a");
    expect((await state.askmeatsackStore!.getById(anonymous))?.ownerAccountId).toBeUndefined();
    const listed = await listRecords(request("/api/v1/account/records", "Bearer token-a"));
    expect(listed.headers.get("cache-control")).toBe("private, no-store");
    expect((await listed.json()).records.map((row: { id: string }) => row.id)).toEqual([a]);
    await Promise.all(
      [b, anonymous, "missing"].map(async (id) => {
        expect(
          (
            await getRecord(
              request("/api/v1/account/records/x", "Bearer token-a"),
              detailContext(id),
            )
          ).status,
        ).toBe(404);
        expect(
          (
            await cancelRecord(
              request("/api/v1/account/records/x/cancel", "Bearer token-a", {}),
              detailContext(id),
            )
          ).status,
        ).toBe(404);
      }),
    );
    const own = await getRecord(
      request("/api/v1/account/records/x", "Bearer token-a"),
      detailContext(a),
    );
    const body = await own.json();
    expect(body.id).toBe(a);
    for (const key of ["agentToken", "publicToken", "manageUrl", "answerUrl"])
      expect(body).not.toHaveProperty(key);
    expect(
      (
        await cancelRecord(
          request("/api/v1/account/records/x/cancel", "Bearer token-a", {}),
          detailContext(a),
        )
      ).status,
    ).toBe(200);
    expect((await state.askmeatsackStore!.getById(a))?.status).toBe("cancelled");
    expect(verifiedFetch.mock.calls.every(([, options]) => options?.cache === "no-store")).toBe(
      true,
    );
  });

  it("fails closed on invalid/malformed/unavailable authority; account routes do not admit anonymous", async () => {
    await Promise.all(
      ["Bearer refused", "Basic token-a", "Bearer malformed space"].map(async (auth) => {
        expect((await createSession(request("/api/v1/sessions", auth, { questions }))).status).toBe(
          401,
        );
        expect((await listRecords(request("/api/v1/account/records", auth))).status).toBe(401);
      }),
    );
    expect((await listRecords(request("/api/v1/account/records"))).status).toBe(401);
    verifiedFetch.mockResolvedValueOnce(Response.json({ account: 123 }));
    expect(
      (await createSession(request("/api/v1/sessions", "Bearer token-a", { questions }))).status,
    ).toBe(401);
    verifiedFetch.mockRejectedValueOnce(new Error("unavailable"));
    expect(
      (await createSession(request("/api/v1/sessions", "Bearer token-a", { questions }))).status,
    ).toBe(401);
    expect((await state.askmeatsackStore!.listByOwner("a")).sessions).toEqual([]);
  });

  it("rejects invalid pagination without a store scan", async () => {
    await Promise.all(
      ["cursor=-1", "cursor=not-a-cursor", "limit=-1", "limit=0"].map(async (query) => {
        expect(
          (await listRecords(request(`/api/v1/account/records?${query}`, "Bearer token-a"))).status,
        ).toBe(400);
      }),
    );
  });
});

function mcpRequest(authorization: string | undefined, id: number) {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name: "ask.imeatsack.com",
        arguments: { action: "create", questions, metadata: { ownerAccountId: "victim" } },
      },
    }),
  });
}

describe("Workspace B3 — MCP verified request attribution", () => {
  it("keeps parallel account contexts separate and refuses bad credentials before invoking a tool", async () => {
    const responses = await Promise.all([
      mcpPost(mcpRequest("Bearer token-a", 1)),
      mcpPost(mcpRequest("Bearer token-b", 2)),
    ]);
    await Promise.all(
      responses.map(async (response) => {
        expect(response.status).toBe(200);
        const body = await response.text();
        expect(body).toContain("answerUrl");
      }),
    );
    expect((await state.askmeatsackStore!.listByOwner("a")).sessions).toHaveLength(1);
    expect((await state.askmeatsackStore!.listByOwner("b")).sessions).toHaveLength(1);
    const anonymous = await mcpPost(mcpRequest(undefined, 3));
    expect(anonymous.status).toBe(200);
    const body = await anonymous.text();
    expect(body).toContain("answerUrl");
    expect((await state.askmeatsackStore!.listByOwner("a")).sessions).toHaveLength(1);
    expect((await state.askmeatsackStore!.listByOwner("b")).sessions).toHaveLength(1);
    expect((await mcpPost(mcpRequest("Bearer invalid", 4))).status).toBe(401);
    expect((await state.askmeatsackStore!.listByOwner("a")).sessions).toHaveLength(1);
  });
});

it("owner edit and cancellation emit safe detail, preserving the agent mutation projection", async () => {
  const id = await create("Bearer token-a");
  const session = (await state.askmeatsackStore!.getById(id))!;
  const edited = await editRecord(
    new Request(`http://localhost/api/v1/account/records/${id}`, {
      method: "PATCH",
      headers: { authorization: "Bearer token-a" },
      body: JSON.stringify({ title: "Retitled" }),
    }),
    detailContext(id),
  );
  expect(edited.status).toBe(200);
  const editDto = await edited.json();
  expect(editDto).toMatchObject({
    id,
    title: "Retitled",
    status: "pending",
    questions: [{ id: "q" }],
    actions: { edit: true, cancel: true },
  });
  expect(JSON.stringify(editDto)).not.toContain(session.agentToken);
  expect(editDto).not.toHaveProperty("manageUrl");
  expect(editDto).not.toHaveProperty("pollUrl");
  const cancelled = await cancelRecord(
    request(`/api/v1/account/records/${id}/cancel`, "Bearer token-a", {}),
    detailContext(id),
  );
  const cancelDto = await cancelled.json();
  expect(cancelDto).toMatchObject({
    id,
    status: "cancelled",
    questions: [{ id: "q" }],
    answers: {},
    actions: { edit: false, cancel: false, share: false },
  });
  expect(cancelDto).not.toHaveProperty("manageUrl");
  expect(JSON.stringify(cancelDto)).not.toContain(session.agentToken);
});
