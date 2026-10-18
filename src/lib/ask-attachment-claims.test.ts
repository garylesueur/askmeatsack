import { createHash, createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createAskAttachmentClaims } from "./ask-attachment-claims";
import { askAttachmentProcessRequest } from "./ask-attachment-request";
import { boundedAskClaimBytes } from "./ask-attachment-objects";
import type { AskMetadata } from "./owned-session-metadata";
import type { AskObjects } from "./owned-answer-objects";
import type { Cleanroom } from "./ask-cleanroom";
import type { AskAttachmentFileWork } from "./ask-attachment-protocol";
const ATTEMPT = "6225b4ba-405e-49bc-8866-51bd8ecdd1e5",
  COPY = "6225b4ba-405e-49bc-8866-51bd8ecdd1e6";
const NOW = 1_790_000_000_000,
  bytes = new TextEncoder().encode("one"),
  digest = createHash("sha256").update(bytes).digest("hex");
const prefix = `askmeatsack/owned/source/claim/${ATTEMPT}/file/${COPY}`;
function fixture(state: AskAttachmentFileWork["state"] = "uploading", handle?: string) {
  const work: AskAttachmentFileWork = {
    fileId: "file",
    questionId: "q",
    sourceId: "source",
    sourceKey: "askmeatsack/source/q/old.txt",
    size: 3,
    contentType: "text/plain",
    state,
    ...(state !== "uploading"
      ? {
          uploadKey: `${prefix}/upload`,
          objectKey: `${prefix}/sealed/content`,
          sha256: digest,
          copyAttemptId: COPY,
          copyDeadlineAt: NOW + 120000,
        }
      : {}),
    ...(handle ? { scanHandle: handle } : {}),
  };
  const storage = new Map<string, Uint8Array>();
  if (state !== "uploading") storage.set(`${prefix}/sealed/content`, bytes);
  const objects: AskObjects = {
    put: vi.fn(async (key, value) => {
      storage.set(key, value);
    }),
    head: vi.fn(async (key) => (storage.has(key) ? { size: storage.get(key)!.length } : null)),
    read: vi.fn(async (key) => storage.get(key)!),
    copy: vi.fn(async (source, target) => {
      storage.set(target, storage.get(source)!);
    }),
    delete: vi.fn(),
    scanUrl: vi.fn(async (key) => `https://objects.example/${key}`),
  };
  const cleanroom: Cleanroom = {
    available: () => true,
    submit: vi.fn(async () => ({
      handle: "scan",
      state: "finished" as const,
      verdict: { verdict: "clean" as const },
    })),
    poll: vi.fn(async () => ({
      handle: handle ?? "scan",
      state: "finished" as const,
      verdict: { verdict: "clean" as const },
    })),
    verifyCallback: vi.fn((_body, signature) => signature === "valid"),
  };
  const call = vi.fn(async (operation: string) => {
    if (operation === "attachmentClaimWork")
      return {
        state: "copying",
        id: "source",
        sourceId: "source",
        attemptId: ATTEMPT,
        snapshotHash: "a".repeat(64),
        cleanupPending: false,
        deadlineAt: NOW + 900000,
        files: [{ ...work }],
      };
    if (operation === "beginAttachmentCopy") {
      work.state = "copying";
      return {
        fileId: "file",
        copyAttemptId: COPY,
        uploadKey: `${prefix}/upload`,
        objectKey: `${prefix}/sealed/content`,
        sha256: digest,
        size: 3,
        deadlineAt: NOW + 120000,
      };
    }
    if (operation === "confirmAttachmentCopy") {
      work.state = "sealed";
      return true;
    }
    if (operation === "beginAttachmentScan")
      return {
        fileId: "file",
        objectKey: `${prefix}/sealed/content`,
        sha256: digest,
        scanAttemptId: COPY,
        size: 3,
        deadlineAt: NOW + 120000,
        ...(handle ? { handle } : {}),
      };
    if (operation === "registerAttachmentScan" || operation === "applyAttachmentScan") return true;
    return null;
  });
  const metadata = { call } as unknown as AskMetadata;
  const readLegacy = vi.fn(async () => bytes);
  const claims = createAskAttachmentClaims({
    metadata,
    objects,
    cleanroom,
    readLegacy,
    now: () => NOW,
    createId: () => COPY,
    callbackBaseUrl: "https://ask.example",
  });
  return { claims, call, objects, cleanroom, readLegacy, work };
}
describe("Ask immutable attachment claim processor", () => {
  it("observes exact legacy bytes, writes one candidate and scans only the sealed owned copy", async () => {
    const f = fixture();
    expect(await f.claims.process("intent")).toBe(true);
    expect(f.readLegacy).toHaveBeenCalledWith("source", "q", "askmeatsack/source/q/old.txt");
    expect(f.objects.put).toHaveBeenCalledExactlyOnceWith(`${prefix}/upload`, bytes, "text/plain");
    expect(f.objects.copy).toHaveBeenCalledExactlyOnceWith(
      `${prefix}/upload`,
      `${prefix}/sealed/content`,
    );
    expect(f.objects.read).toHaveBeenCalledExactlyOnceWith(
      `${prefix}/sealed/content`,
      4 * 1024 * 1024,
    );
    expect(f.cleanroom.submit).toHaveBeenCalledExactlyOnceWith({
      url: `https://objects.example/${prefix}/sealed/content`,
      declaredSizeBytes: 3,
      callbackUrl: "https://ask.example/api/v1/claims/scan-result",
      submissionKey: `ask-claim:intent:file:${COPY}`,
    });
    expect(f.call).toHaveBeenCalledWith("applyAttachmentScan", { handle: "scan", status: "clean" });
    expect(f.call).toHaveBeenLastCalledWith("commitAttachmentClaim", { intentId: "intent" });
  });
  it("reconciles an uncertain copy response without granting another writer or rereading legacy bytes", async () => {
    const f = fixture("copying");
    expect(await f.claims.process("intent")).toBe(true);
    expect(f.readLegacy).not.toHaveBeenCalled();
    expect(f.objects.put).not.toHaveBeenCalled();
    expect(f.objects.copy).not.toHaveBeenCalled();
    expect(f.call).not.toHaveBeenCalledWith("beginAttachmentCopy", expect.anything());
    expect(f.call).toHaveBeenCalledWith("confirmAttachmentCopy", {
      intentId: "intent",
      fileId: "file",
      copyAttemptId: COPY,
      sha256: digest,
      observedBytes: 3,
    });
  });
  it("refuses a corrupted destination before confirmation or scanning", async () => {
    const f = fixture("copying");
    vi.mocked(f.objects.read!).mockResolvedValue(new TextEncoder().encode("two"));
    await expect(f.claims.process("intent")).rejects.toMatchObject({ code: "storage_unavailable" });
    expect(f.cleanroom.submit).not.toHaveBeenCalled();
    expect(f.call).not.toHaveBeenCalledWith("confirmAttachmentCopy", expect.anything());
    expect(f.call).not.toHaveBeenCalledWith("commitAttachmentClaim", expect.anything());
  });
  it("refuses a foreign source key before reading or writing storage", async () => {
    const f = fixture();
    f.work.sourceKey = "askmeatsack/other/q/old.txt";
    await expect(f.claims.process("intent")).rejects.toMatchObject({ code: "storage_unavailable" });
    expect(f.readLegacy).not.toHaveBeenCalled();
    expect(f.objects.put).not.toHaveBeenCalled();
  });
  it("never applies a scanner poll for another handle and refuses malformed submission handles", async () => {
    const f = fixture("sealed", "expected");
    vi.mocked(f.cleanroom.poll).mockResolvedValue({
      handle: "foreign",
      state: "finished" as const,
      verdict: { verdict: "clean" as const },
    });
    await expect(f.claims.process("intent")).rejects.toMatchObject({ code: "storage_unavailable" });
    expect(f.call).not.toHaveBeenCalledWith("applyAttachmentScan", expect.anything());
    const next = fixture("sealed");
    vi.mocked(next.cleanroom.submit).mockResolvedValue({
      handle: "",
      state: "finished" as const,
      verdict: { verdict: "clean" as const },
    });
    await expect(next.claims.process("intent")).rejects.toMatchObject({
      code: "storage_unavailable",
    });
    expect(next.call).not.toHaveBeenCalledWith("registerAttachmentScan", expect.anything());
  });
  it("signed scan callbacks can only apply known verdicts and too-large becomes failed", async () => {
    const f = fixture();
    const body = JSON.stringify({ data: { handle: "scan", verdict: { verdict: "too-large" } } });
    expect(await f.claims.callback(body, "wrong")).toBe(false);
    expect(f.call).not.toHaveBeenCalled();
    expect(await f.claims.callback(body, "valid")).toBe(true);
    expect(f.call).toHaveBeenCalledExactlyOnceWith("applyAttachmentScan", {
      handle: "scan",
      status: "failed",
    });
    expect(
      await f.claims.callback(
        JSON.stringify({ handle: "scan", verdict: { verdict: "unknown" } }),
        "valid",
      ),
    ).toBe(false);
  });
});
describe("Ask worker request and byte admission", () => {
  const secret = "synthetic-secret";
  function request(body: string, valid = true) {
    const seconds = Math.floor(NOW / 1000);
    return new Request("http://localhost/api/v1/claims/process", {
      method: "POST",
      body,
      headers: {
        "ask-claim-process-signature": `t=${seconds},v1=${createHmac(
          "sha256",
          valid ? secret : "wrong",
        )
          .update(`${seconds}.ask-claim-process.${body}`)
          .digest("hex")}`,
      },
    });
  }
  it("accepts only signed intent-only processing and never treats an unknown intent as an acknowledgement", async () => {
    const process = vi.fn(async () => true),
      deps = { secret, process, now: () => NOW };
    const response = await askAttachmentProcessRequest(
      request(JSON.stringify({ intentId: "intent" })),
      deps,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, intentId: "intent" });
    process.mockClear();
    expect(
      (
        await askAttachmentProcessRequest(
          request(JSON.stringify({ intentId: "intent" }), false),
          deps,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await askAttachmentProcessRequest(
          request(JSON.stringify({ intentId: "intent", outcome: "committed" })),
          deps,
        )
      ).status,
    ).toBe(400);
    expect((await askAttachmentProcessRequest(request("{"), deps)).status).toBe(400);
    expect(process).not.toHaveBeenCalled();
    process.mockResolvedValue(false);
    expect(
      (await askAttachmentProcessRequest(request(JSON.stringify({ intentId: "unknown" })), deps))
        .status,
    ).toBe(503);
  });
  it("bounds actual source byte bodies without trusting absent or small declared length", async () => {
    expect(await boundedAskClaimBytes(new Response(bytes), 3)).toEqual(bytes);
    await expect(
      boundedAskClaimBytes(
        new Response(new Uint8Array(4), { headers: { "content-length": "3" } }),
        3,
      ),
    ).rejects.toThrow();
    await expect(boundedAskClaimBytes(new Response(bytes, { status: 404 }), 3)).rejects.toThrow();
  });
});
