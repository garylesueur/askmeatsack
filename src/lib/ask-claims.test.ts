import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createAskClaims } from "./ask-claims";
import { createMemorySessionStore, type Session } from "./session-store";
import { createOwnedSessionStore } from "./owned-session-store";
import {
  OwnedSessionError,
  type AskMetadata,
  type AskMetadataOperation,
  type OwnedEnvelope,
} from "./owned-session-metadata";
import type { AskClaimIntent, AskClaimReceipt } from "./ask-claim-protocol";
const ATTEMPT = "6225b4ba-405e-49bc-8866-51bd8ecdd1e5";
const FRESH = "6225b4ba-405e-49bc-8866-51bd8ecdd1e6";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function fixture() {
  const now = Date.parse("2026-10-11T12:00:00Z");
  const session: Session = {
    id: "legacy-request",
    createdAt: "2026-10-10T12:00:00Z",
    expiresAt: "2026-10-11T11:00:00Z",
    submittedAt: "2026-10-11T11:30:00Z",
    status: "submitted",
    questions: [],
    answers: {
      q: { selectedOptionIds: [], text: "Original answer", answeredAt: "2026-10-11T11:29:00Z" },
    },
    publicToken: "public-proof",
    agentToken: "private-proof",
    callbackUrl: "https://example.com/callback",
    callbackSent: true,
  };
  const legacy = createMemorySessionStore(() => new Date(now));
  await legacy.save(session);
  const order: string[] = [];
  const controls = {
    mode: "commit" as "commit" | "capacity" | "lost" | "unknown",
    failReads: false,
    foreignOverlay: false,
    retired: false,
  };
  const intent: AskClaimIntent = {
    product: "askmeatsack",
    intentId: "intent",
    accountId: "account-a",
    sourceId: session.id,
    attemptId: ATTEMPT,
    proofHash: hash(session.agentToken),
    state: "prepared",
    createdAt: now,
    deadlineAt: now + 900_000,
    sourceResolved: false,
  };
  let owned: OwnedEnvelope | null = null,
    receipt: AskClaimReceipt | null = null;
  const writes: Record<string, unknown>[] = [];
  const metadata: AskMetadata = {
    async call<T>(operation: AskMetadataOperation, input: Record<string, unknown>) {
      if (operation === "getById")
        return (
          controls.retired
            ? { retired: true }
            : controls.foreignOverlay
              ? { session: JSON.stringify({ ...session, ownerAccountId: "foreign" }), revision: 0 }
              : owned
        ) as T;
      if (operation === "getClaim") return receipt as T;
      if (operation !== "claimRequest") throw new Error("Unexpected metadata operation");
      order.push("import");
      writes.push(input);
      if (controls.mode === "capacity") throw new OwnedSessionError("request_capacity", 409);
      if (controls.mode === "unknown") throw new OwnedSessionError("storage_unavailable");
      const snapshot = JSON.parse(String(input.session));
      owned = {
        session: JSON.stringify({ ...snapshot, ownerAccountId: "account-a" }),
        revision: 0,
      };
      receipt = {
        state: "committed",
        id: session.id,
        sourceId: session.id,
        attemptId: ATTEMPT,
        snapshotHash: String(input.snapshotHash),
        request: owned,
      };
      intent.state = "committed";
      if (controls.mode === "lost") throw new OwnedSessionError("storage_unavailable");
      return receipt as T;
    },
  };
  const actual = legacy.beginClaim.bind(legacy);
  vi.spyOn(legacy, "beginClaim").mockImplementation(async (...args) => {
    order.push("fence");
    return actual(...args);
  });
  const store = createOwnedSessionStore(legacy, metadata);
  const prepare = vi.fn(async () => {
    order.push("prepare");
    return structuredClone(intent);
  });
  const get = vi.fn(async () => {
    if (controls.failReads) throw new OwnedSessionError("storage_unavailable");
    return structuredClone(intent);
  });
  const cancel = vi.fn(async () => {
    if (intent.state === "prepared") intent.state = "aborted";
    return structuredClone(intent);
  });
  const claims = createAskClaims({ store, metadata, intents: { prepare, get, cancel } });
  const input = {
    accountId: "account-a",
    sourceId: session.id,
    attemptId: FRESH,
    proof: session.agentToken,
  };
  const resolution = {
    product: "askmeatsack" as const,
    intentId: "intent",
    accountId: "account-a",
    sourceId: session.id,
    attemptId: ATTEMPT,
    proofHash: intent.proofHash,
    outcome: "aborted" as "aborted" | "committed",
  };
  return {
    claims,
    input,
    resolution,
    legacy,
    session,
    intent,
    controls,
    prepare,
    get,
    cancel,
    writes,
    order,
    store,
  };
}
describe("Ask metadata-only product claim coordinator", () => {
  it("prepares before fencing, uses returned attempt and imports exact completed snapshot without resetting identity or time", async () => {
    const f = await fixture();
    expect(await f.claims.claim("account-a", f.input)).toEqual({
      state: "committed",
      id: f.session.id,
    });
    expect(f.order).toEqual(["prepare", "fence", "import"]);
    expect(f.writes[0]).toMatchObject({
      attemptId: ATTEMPT,
      intentId: "intent",
      proofHash: hash(f.input.proof),
      session: JSON.stringify(f.session),
      snapshotHash: hash(JSON.stringify(f.session)),
    });
    expect(await f.legacy.getById(f.session.id)).toBeNull();
    expect(await f.store.getById(f.session.id)).toMatchObject({
      ...f.session,
      ownerAccountId: "account-a",
      storageRevision: 0,
    });
    await expect(f.legacy.save(f.session)).rejects.toThrow("fenced");
    expect(await f.claims.claim("account-a", f.input)).toEqual({
      state: "committed",
      id: f.session.id,
    });
    expect(f.writes).toHaveLength(1);
  });
  it("refuses public/invalid proof and foreign durable ownership generically before preparing", async () => {
    const f = await fixture();
    await expect(
      f.claims.claim("account-a", { ...f.input, proof: f.session.publicToken }),
    ).rejects.toMatchObject({ code: "claim_unavailable", status: 404 });
    f.controls.foreignOverlay = true;
    await expect(f.claims.claim("account-a", f.input)).rejects.toMatchObject({
      code: "claim_unavailable",
      status: 404,
    });
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it("recovers existing native ownership only with the same verified account and private proof after intent scrub", async () => {
    const f = await fixture();
    await f.claims.claim("account-a", f.input);
    f.prepare.mockRejectedValue(new Error("scrubbed prepare must not be used"));
    f.get.mockRejectedValue(new Error("scrubbed status must not be used"));
    expect(await f.claims.claim("account-a", f.input)).toEqual({
      state: "committed",
      id: f.session.id,
    });
    await expect(
      f.claims.claim("account-a", { ...f.input, proof: f.session.publicToken }),
    ).rejects.toMatchObject({ code: "claim_unavailable" });
    await expect(f.claims.claim("other-account", f.input)).rejects.toMatchObject({
      code: "claim_unavailable",
    });
    expect(f.prepare).toHaveBeenCalledTimes(1);
    f.controls.retired = true;
    await expect(f.claims.claim("account-a", f.input)).rejects.toMatchObject({
      code: "claim_unavailable",
    });
  });
  it("refuses a legacy attributed owner even when account and private proof match", async () => {
    const f = await fixture();
    await f.legacy.delete(f.session.id);
    await f.legacy.save({ ...f.session, ownerAccountId: "account-a" });
    await expect(f.claims.claim("account-a", f.input)).rejects.toMatchObject({
      code: "claim_unavailable",
    });
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it("retains every attachment descriptor and aborts prepared work explicitly instead of dropping files", async () => {
    const f = await fixture();
    const file = {
      id: "file",
      questionId: "q",
      filename: "report.pdf",
      contentType: "application/pdf",
      size: 1,
      url: "https://example.com/file",
      key: "original-key",
    };
    f.session.answers.q.files = [file];
    await f.legacy.save(f.session);
    await expect(f.claims.claim("account-a", f.input)).rejects.toMatchObject({
      code: "claim_files_unsupported",
    });
    expect(f.writes).toEqual([]);
    expect(f.cancel).toHaveBeenCalledTimes(1);
    expect(await f.legacy.getById(f.session.id)).toEqual(f.session);
    expect(await f.legacy.beginClaim(f.session.id, "account-a", ATTEMPT, f.input.proof)).toBeNull();
  });
  it("stages full attachments only after prepared intent and exact source fence, then leaves started work pinned for the durable worker", async () => {
    const f = await fixture();
    const file = {
      id: "file",
      questionId: "q",
      filename: "report.pdf",
      contentType: "application/pdf",
      size: 1,
      url: "https://example.com/file",
      key: "askmeatsack/legacy-request/q/report.pdf",
      uploadedAt: "2026-10-11T11:30:00Z",
    };
    f.session.uploads = { file };
    f.session.answers.q.files = [file];
    await f.legacy.save(f.session);
    const begin = vi.fn(async (binding, snapshotHash, snapshot) => {
      f.order.push("stage");
      expect(binding.attemptId).toBe(ATTEMPT);
      expect(snapshot).toBe(JSON.stringify(f.session));
      expect(snapshotHash).toBe(hash(snapshot));
      await expect(f.legacy.save(f.session)).rejects.toThrow("fenced");
      f.intent.state = "started";
      return {
        state: "copying" as const,
        id: f.session.id,
        sourceId: f.session.id,
        attemptId: ATTEMPT,
        snapshotHash,
        cleanupPending: false,
      };
    });
    const claims = createAskClaims({
      store: f.store,
      metadata: { call: vi.fn() },
      intents: { prepare: f.prepare, get: f.get, cancel: f.cancel },
      attachments: { begin },
    });
    expect(await claims.claim("account-a", f.input)).toEqual({ state: "pending" });
    expect(f.order).toEqual(["prepare", "fence", "stage"]);
    expect(await claims.claim("account-a", f.input)).toEqual({ state: "pending" });
    expect(begin).toHaveBeenCalledOnce();
    expect(f.cancel).not.toHaveBeenCalled();
    expect(await f.legacy.inspectClaim(f.session.id, "account-a", ATTEMPT)).toBe("pending");
  });
  it("cancels only still-prepared capacity refusals and reads definitive abort before restoring the source", async () => {
    const f = await fixture();
    f.controls.mode = "capacity";
    await expect(f.claims.claim("account-a", f.input)).rejects.toMatchObject({
      code: "request_capacity",
    });
    expect(f.intent.state).toBe("aborted");
    expect(f.cancel).toHaveBeenCalledTimes(1);
    expect(await f.legacy.inspectClaim(f.session.id, "account-a", ATTEMPT)).toBe("none");
    await f.legacy.save({ ...f.session, title: "still unowned" });
    expect((await f.legacy.getById(f.session.id))?.ownerAccountId).toBeUndefined();
  });
  it("reconciles a lost successful native response to the committed receipt without aborting", async () => {
    const f = await fixture();
    f.controls.mode = "lost";
    expect(await f.claims.claim("account-a", f.input)).toEqual({
      state: "committed",
      id: f.session.id,
    });
    expect(f.cancel).not.toHaveBeenCalled();
    expect(await f.legacy.inspectClaim(f.session.id, "account-a", ATTEMPT)).toBe("committed");
  });
  it("never unlocks or cancels started work when its native receipt is unknown", async () => {
    const f = await fixture();
    f.intent.state = "started";
    expect(await f.claims.claim("account-a", f.input)).toEqual({ state: "pending" });
    expect(f.writes).toEqual([]);
    expect(f.cancel).not.toHaveBeenCalled();
    await expect(f.legacy.save(f.session)).rejects.toThrow("fenced");
  });
  it("keeps a fence when durable reconciliation is unavailable after uncertain import", async () => {
    const f = await fixture();
    f.controls.mode = "unknown";
    f.controls.failReads = true;
    await expect(f.claims.claim("account-a", f.input)).rejects.toMatchObject({
      code: "storage_unavailable",
    });
    expect(f.cancel).not.toHaveBeenCalled();
    expect(await f.legacy.inspectClaim(f.session.id, "account-a", ATTEMPT)).toBe("pending");
  });
  it("installs an aborted-before-fence barrier only from fresh matching terminal intent", async () => {
    const f = await fixture();
    expect(await f.claims.resolve(f.resolution)).toBe(false);
    f.intent.state = "aborted";
    expect(await f.claims.resolve(f.resolution)).toBe(true);
    expect(await f.legacy.beginClaim(f.session.id, "account-a", ATTEMPT, f.input.proof)).toBeNull();
    expect(await f.legacy.getById(f.session.id)).toEqual(f.session);
  });
  it("never resolves a foreign source election or a mismatched terminal outcome", async () => {
    const f = await fixture();
    f.intent.state = "aborted";
    await f.legacy.beginClaim(f.session.id, "other-account", FRESH, f.input.proof);
    expect(await f.claims.resolve(f.resolution)).toBe(false);
    expect(await f.claims.resolve({ ...f.resolution, outcome: "committed" })).toBe(false);
    expect(await f.legacy.inspectClaim(f.session.id, "other-account", FRESH)).toBe("pending");
  });
  it("can retire a committed source after account deletion without reopening the missing native request", async () => {
    const f = await fixture();
    await f.legacy.beginClaim(f.session.id, "account-a", ATTEMPT, f.input.proof);
    f.intent.state = "committed";
    expect(await f.claims.resolve({ ...f.resolution, outcome: "committed" })).toBe(true);
    expect(await f.legacy.getById(f.session.id)).toBeNull();
    expect(await f.legacy.inspectClaim(f.session.id, "account-a", ATTEMPT)).toBe("committed");
    expect(await f.claims.resolve({ ...f.resolution, outcome: "committed" })).toBe(true);
  });
});
