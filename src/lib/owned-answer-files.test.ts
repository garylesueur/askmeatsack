import { createHmac } from "node:crypto";
import { describe, expect, it, vi, afterEach } from "vitest";
import { createOwnedAnswerFiles, safeKeptFile } from "./owned-answer-files";
import { createOwnedAnswerObjects, type AskObjects } from "./owned-answer-objects";
import {
  executeAskCleanup,
  verifyAskCleanupSignature,
  type AskCleanupGrant,
} from "./owned-files-cleanup";
import type { AskMetadata, AskMetadataOperation } from "./owned-session-metadata";
import type { Cleanroom, ScanSubmitResult } from "./ask-cleanroom";

function fixture(
  options: {
    verdict?: ScanSubmitResult["verdict"];
    scannerFails?: boolean;
    commit?: boolean;
    keep?: "copying" | "kept" | "busy";
  } = {},
) {
  const objectsMap = new Map<string, Uint8Array>();
  const events: { operation: string; input: Record<string, unknown> }[] = [];
  const objects: AskObjects = {
    put: vi.fn(async (key, bytes) => {
      objectsMap.set(key, bytes);
    }),
    head: vi.fn(async (key) =>
      objectsMap.has(key) ? { size: objectsMap.get(key)!.byteLength } : null,
    ),
    copy: vi.fn(async (source, target) => {
      const bytes = objectsMap.get(source);
      if (!bytes) throw new Error("missing");
      objectsMap.set(target, new Uint8Array(bytes));
    }),
    delete: vi.fn(async (key) => {
      objectsMap.delete(key);
    }),
    scanUrl: vi.fn(async () => "https://storage.example/signed-read"),
  };
  const uploadKey = "askmeatsack/owned/request/file/upload";
  const objectKey = "askmeatsack/owned/request/file/sealed/attempt";
  const keptKey = "askmeatsack/kept/target/sealed/attempt";
  const file = {
    id: "target",
    name: "answer.txt",
    contentType: "text/plain",
    size: 3,
    createdAt: 1000,
    status: options.keep === "kept" ? "available" : "copying",
    receivedAt: 500,
  };
  const metadata: AskMetadata = {
    async call<T>(operation: AskMetadataOperation, input: Record<string, unknown>) {
      events.push({ operation, input });
      let result: unknown;
      switch (operation) {
        case "reserveUpload":
          result = { fileId: "file", uploadKey, writeDeadlineAt: 120000 };
          break;
        case "beginSeal":
          result = { uploadKey, objectKey, attemptId: "attempt", deadlineAt: 120000 };
          break;
        case "commitSeal":
          result = options.commit === false ? null : { session: "{}", revision: 1 };
          break;
        case "beginScan":
          result = {
            fileId: "file",
            objectKey,
            attemptId: "attempt",
            deadlineAt: 120000,
            status: "scanning",
          };
          break;
        case "registerScan":
        case "lookupScan":
        case "applyScan":
          result = true;
          break;
        case "beginKeep":
          result = {
            status: options.keep === "kept" ? "kept" : "copying",
            file,
            sourceKey: objectKey,
            objectKey: keptKey,
            attemptId: options.keep === "busy" ? "other" : input.attemptId,
            deadlineAt: 120000,
          };
          break;
        case "commitKeep":
          result = options.commit === false ? null : { ...file, status: "available" };
          break;
      }
      return result as T;
    },
  };
  const cleanroom: Cleanroom = {
    available: () => true,
    submit: vi.fn(async () => {
      if (options.scannerFails) throw new Error("scanner offline");
      return {
        handle: "handle",
        state: "finished" as const,
        verdict: options.verdict ?? { verdict: "clean" },
      };
    }),
    poll: vi.fn(async () => null),
    verifyCallback: vi.fn((_, header) => header === "verified"),
  };
  let id = 0;
  const files = createOwnedAnswerFiles({
    metadata,
    objects,
    cleanroom,
    publicBaseUrl: "https://ask.imeatsack.com",
    now: () => 1000,
    createId: () => (id++ === 0 ? "file" : "attempt"),
  });
  return { files, metadata, objects, objectsMap, events, cleanroom, uploadKey, objectKey, keptKey };
}
const upload = {
  id: "request",
  questionId: "q",
  filename: "answer.txt",
  contentType: "text/plain",
  bytes: new Uint8Array([1, 2, 3]),
  publicToken: "public-token",
};
const keep = { accountId: "a", requestId: "request", fileId: "file", id: "target" };

describe("Owned attachment operations", () => {
  it("seals fixed keys, verifies bytes and registers actual scan authority before clean", async () => {
    const f = fixture();
    expect(await f.files.upload(upload)).toEqual({ fileId: "file" });
    expect(f.objects.copy).toHaveBeenCalledWith(f.uploadKey, f.objectKey);
    expect(f.events.map((e) => e.operation)).toEqual([
      "reserveUpload",
      "beginSeal",
      "commitSeal",
      "beginScan",
      "registerScan",
      "applyScan",
    ]);
    expect(f.events.at(-1)?.input).toEqual({ handle: "handle", status: "clean" });
    expect(f.events[2].input).toMatchObject({
      observedBytes: 3,
      url: "https://ask.imeatsack.com/api/v1/sessions/request/files/file?t=public-token",
    });
  });
  it("does not attach a size-mismatched seal or manufacture clean on scanner outage", async () => {
    const f = fixture();
    vi.mocked(f.objects.head).mockResolvedValue({ size: 2 });
    await expect(f.files.upload(upload)).rejects.toThrow("size mismatch");
    expect(f.events.some((e) => e.operation === "commitSeal")).toBe(false);
    expect(f.events.at(-1)?.operation).toBe("failSeal");
    const outage = fixture({ scannerFails: true });
    expect(await outage.files.upload(upload)).toEqual({ fileId: "file" });
    expect(outage.events.some((e) => e.operation === "commitSeal")).toBe(true);
    expect(outage.events.some((e) => e.operation === "applyScan")).toBe(false);
  });
  it("does not revive a request retired while sealing, and rejected scans stay blocked", async () => {
    const f = fixture({ commit: false });
    await expect(f.files.upload(upload)).rejects.toMatchObject({ code: "conflict" });
    expect(f.cleanroom.submit).not.toHaveBeenCalled();
    expect(f.events.at(-1)?.operation).toBe("failSeal");
    const oversized = fixture({
      verdict: { verdict: "too-large", declaredSizeBytes: 3, capBytes: 2 },
    });
    await oversized.files.upload(upload);
    expect(oversized.events.at(-1)?.input).toMatchObject({ status: "failed" });
  });
  it("reuses an already kept copy without copy/charge and rejects a Keep race at commit", async () => {
    const done = fixture({ keep: "kept" });
    expect(await done.files.keep(keep)).toMatchObject({
      status: "kept",
      file: { id: "target", canRead: true },
    });
    expect(done.objects.copy).not.toHaveBeenCalled();
    expect(done.events).toHaveLength(1);
    const race = fixture({ commit: false });
    race.objectsMap.set(race.objectKey, upload.bytes);
    // Keep uses its own attempt id on this fresh operation.
    race.events.length = 0;
    await expect(race.files.keep(keep)).rejects.toMatchObject({ code: "conflict" });
    expect(race.events.at(-1)?.operation).toBe("abortKeep");
  });
  it("does not abort another retry's exclusive Keep copy lease", async () => {
    const f = fixture({ keep: "busy" });
    await expect(f.files.keep(keep)).rejects.toMatchObject({ code: "conflict" });
    expect(f.events.map((e) => e.operation)).toEqual(["beginKeep"]);
    expect(f.objects.copy).not.toHaveBeenCalled();
  });
  it("denies forged callbacks and hides private kept keys while normalizing dates", async () => {
    const f = fixture();
    expect(
      await f.files.callback(
        JSON.stringify({ handle: "handle", verdict: { verdict: "clean" } }),
        "forged",
      ),
    ).toBe(false);
    expect(f.events).toHaveLength(0);
    expect(
      await f.files.callback(
        JSON.stringify({ handle: "handle", verdict: { verdict: "infected", signature: "test" } }),
        "verified",
      ),
    ).toBe(true);
    expect(f.events.at(-1)?.input).toMatchObject({ status: "infected" });
    const safe = safeKeptFile({
      id: "id",
      name: "name",
      contentType: "text/plain",
      size: 3,
      createdAt: 1000,
      status: "available",
      objectKey: "secret-object-key",
    });
    expect(safe.createdAt).toBe("1970-01-01T00:00:01.000Z");
    expect(JSON.stringify(safe)).not.toContain("secret-object-key");
  });
});

describe("Frozen Ask cleanup authority", () => {
  const grant: AskCleanupGrant = {
    id: "cleanup",
    keys: [
      "askmeatsack/owned/request/file/upload",
      "askmeatsack/owned/request/file/sealed/attempt",
    ],
    writeDeadlineAt: 120000,
    cleanupAt: 240000,
  };
  function cleanup(grants: (AskCleanupGrant | null)[]) {
    const f = fixture();
    let index = 0;
    const calls: string[] = [];
    const metadata: AskMetadata = {
      async call<T>(operation: AskMetadataOperation) {
        calls.push(operation);
        return grants[index++] as T;
      },
    };
    f.objectsMap.set(grant.keys[0], upload.bytes);
    f.objectsMap.set(grant.keys[1], upload.bytes);
    f.objectsMap.set("askmeatsack/kept/independent/sealed/other", upload.bytes);
    return { ...f, metadata, calls };
  }
  it("waits for cleanup grace and rechecks frozen authority before storage removal", async () => {
    const early = cleanup([grant]);
    expect(
      await executeAskCleanup({ id: grant.id }, { ...early, now: () => 230000 }),
    ).toMatchObject({ ok: false });
    expect(early.objects.delete).not.toHaveBeenCalled();
    const changed = cleanup([grant, { ...grant, keys: ["askmeatsack/owned/new/file/upload"] }]);
    expect(
      await executeAskCleanup({ id: grant.id }, { ...changed, now: () => 250000 }),
    ).toMatchObject({ ok: false });
    expect(changed.objects.delete).not.toHaveBeenCalled();
  });
  it("confirms every issued key absent, never removes independent Keep and leaves count release to worker", async () => {
    const f = cleanup([grant, grant]);
    expect(await executeAskCleanup({ id: grant.id }, { ...f, now: () => 250000 })).toEqual({
      ok: true,
      pendingCleanup: false,
    });
    expect(f.objectsMap.has("askmeatsack/kept/independent/sealed/other")).toBe(true);
    expect(f.calls).toEqual(["authorizeCleanup", "authorizeCleanup"]);
    const lingering = cleanup([grant, grant]);
    vi.mocked(lingering.objects.delete).mockImplementation(async () => {});
    expect(
      await executeAskCleanup({ id: grant.id }, { ...lingering, now: () => 250000 }),
    ).toMatchObject({ ok: false, pendingCleanup: true });
  });
  it("uses a distinct timestamped cleanup HMAC", () => {
    const body = JSON.stringify({ id: "cleanup" });
    const digest = createHmac("sha256", "ask-only")
      .update(`1000.ask-cleanup.${body}`)
      .digest("hex");
    expect(verifyAskCleanupSignature(body, `t=1000,v1=${digest}`, "ask-only", 1000000)).toBe(true);
    expect(verifyAskCleanupSignature(body, `t=1000,v1=${digest}`, "share-only", 1000000)).toBe(
      false,
    );
    expect(verifyAskCleanupSignature(body, `t=1000,v1=${digest}`, "ask-only", 2000000)).toBe(false);
  });
});

afterEach(() => vi.unstubAllGlobals());
it("rejects S3 embedded HTTP200 copy errors and bounds storage writes", async () => {
  const send = vi.fn<typeof fetch>(
    async () => new Response("<Error><Code>SlowDown</Code></Error>", { status: 200 }),
  );
  vi.stubGlobal("fetch", send);
  const objects = createOwnedAnswerObjects({
    accountId: "fake",
    accessKeyId: "fake",
    secretAccessKey: "fake",
    bucket: "ask-dev",
    endpoint: "https://fake.storage.example",
  });
  await expect(
    objects.copy(
      "askmeatsack/owned/request/file/upload",
      "askmeatsack/owned/request/file/sealed/attempt",
    ),
  ).rejects.toThrow("confirm copy");
  expect(send.mock.calls[0][0]).toBeInstanceOf(Request);
  await expect(
    objects.put("askmeatsack/owned/request/file/sealed/attempt", upload.bytes, "text/plain"),
  ).rejects.toThrow("staging");
});
