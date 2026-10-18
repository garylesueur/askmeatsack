import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as list } from "./route";
import { GET as detail, DELETE as remove } from "./[fileId]/route";
import { POST as keep } from "../records/[recordId]/files/[fileId]/keep/route";
const send = vi.fn<typeof fetch>();
const operations: { operation: string; input: Record<string, unknown> }[] = [];
const file = {
  id: "kept",
  name: "answer.txt",
  contentType: "text/plain",
  size: 3,
  createdAt: 1000,
  status: "available",
  objectKey: "askmeatsack/kept/private/sealed/secret",
  receivedAt: 500,
  sourceRequestId: "removed-request",
  sourceFileId: "original-file",
};
beforeEach(() => {
  operations.length = 0;
  vi.stubGlobal("fetch", send);
  send.mockReset();
  vi.stubEnv("ASK_METADATA_SECRET", "ask-test-only");
  vi.stubEnv("R2_ACCOUNT_ID", "fake");
  vi.stubEnv("R2_ACCESS_KEY_ID", "fake");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "fake");
  vi.stubEnv("R2_BUCKET_NAME", "ask-test");
  vi.stubEnv("CLEANROOM_URL", "https://scanner.example");
  vi.stubEnv("CLEANROOM_SERVICE_CREDENTIAL", "scanner-test");
  vi.stubEnv("CLEANROOM_WEBHOOK_SECRET", "scanner-test");
  send.mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if ("token" in body)
      return body.token === "verified-a"
        ? Response.json({ account: "a" })
        : Response.json({ error: "refused" }, { status: 401 });
    operations.push(body);
    if (body.input.accountId !== "a")
      return Response.json({ error: "ineligible_file" }, { status: 409 });
    if (body.operation === "listKept") return Response.json({ files: [file], nextCursor: null });
    if (body.operation === "allowance")
      return Response.json({ requests: 0, requestLimit: 500, bytes: 3, byteLimit: 1000000000 });
    if (body.operation === "getKept") return Response.json(file);
    if (body.operation === "removeKept")
      return Response.json({ removed: true, cleanupPending: true });
    if (body.operation === "beginKeep")
      return body.input.requestId === "foreign-request"
        ? Response.json({ error: "ineligible_file" }, { status: 409 })
        : Response.json({ status: "kept", file });
    return Response.json(null);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function request(path: string, token?: string, method = "GET", body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
describe("Independent kept file HTTP authority", () => {
  it("denies anonymous/refused readers before signed metadata access", async () => {
    expect((await list(request("/api/v1/account/kept-files"))).status).toBe(401);
    expect(
      (
        await detail(request("/api/v1/account/kept-files/kept", "invalid"), {
          params: Promise.resolve({ fileId: "kept" }),
        })
      ).status,
    ).toBe(401);
    expect(operations).toEqual([]);
  });
  it("lists retained copies even after source deletion with ISO dates and no private keys", async () => {
    const response = await list(
      request("/api/v1/account/kept-files?search=answer&limit=25", "verified-a"),
    );
    const json = await response.json();
    expect(json).toMatchObject({
      files: [
        { id: "kept", canRead: true, canRetryScan: false, createdAt: "1970-01-01T00:00:01.000Z" },
      ],
      usage: { usedBytes: 3 },
    });
    expect(JSON.stringify(json)).not.toContain("/sealed/");
    expect(operations[0].input).toMatchObject({ accountId: "a", search: "answer", limit: 25 });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const single = await detail(request("/api/v1/account/kept-files/kept", "verified-a"), {
      params: Promise.resolve({ fileId: "kept" }),
    });
    expect(JSON.stringify(await single.json())).not.toContain("secret");
  });
  it("uses verified account for Keep, ignores forged body authority and surfaces cleanup state", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const response = await keep(
      request("/api/v1/account/records/owned/files/original/keep", "verified-a", "POST", {
        id,
        accountId: "b",
      }),
      { params: Promise.resolve({ recordId: "owned", fileId: "original" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "kept", file: { canRead: true } });
    expect(operations[0].input).toMatchObject({ accountId: "a", id, requestId: "owned" });
    const foreign = await keep(
      request("/api/v1/account/records/foreign-request/files/original/keep", "verified-a", "POST", {
        id,
      }),
      { params: Promise.resolve({ recordId: "foreign-request", fileId: "original" }) },
    );
    expect(foreign.status).toBe(409);
    const removed = await remove(
      request("/api/v1/account/kept-files/kept", "verified-a", "DELETE"),
      { params: Promise.resolve({ fileId: "kept" }) },
    );
    expect(await removed.json()).toEqual({ removed: true, pendingCleanup: true });
  });
});
