import { createHash, randomUUID } from "node:crypto";
import { OwnedSessionError, defaultAskMetadata, type AskMetadata } from "./owned-session-metadata";
import {
  createHttpCleanroom,
  readCleanroomConfig,
  type Cleanroom,
  type ScanSubmitResult,
} from "./ask-cleanroom";
import { defaultOwnedAnswerObjects, type AskObjects } from "./owned-answer-objects";
import { defaultLegacyAskClaimReader } from "./ask-attachment-objects";
import {
  askAttachmentReceiptSchema,
  askAttachmentWorkSchema,
  askAttachmentCopyGrantSchema,
  askAttachmentScanGrantSchema,
  validLegacyAskClaimKey,
  type AskAttachmentFileWork,
} from "./ask-attachment-protocol";
import type { AskClaimBinding } from "./ask-claim-protocol";
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
export function createAskAttachmentClaims(deps: {
  metadata: AskMetadata;
  objects: AskObjects;
  readLegacy(sourceId: string, questionId: string, key: string): Promise<Uint8Array>;
  cleanroom: Cleanroom;
  callbackBaseUrl: string;
  now?: () => number;
  createId?: () => string;
}) {
  const now = deps.now ?? Date.now,
    createId = deps.createId ?? randomUUID;
  const call = deps.metadata.call.bind(deps.metadata);
  async function apply(result: ScanSubmitResult) {
    if (!result.verdict) return;
    await call("applyAttachmentScan", {
      handle: result.handle,
      status:
        result.verdict.verdict === "clean"
          ? "clean"
          : result.verdict.verdict === "infected"
            ? "infected"
            : "failed",
    });
  }
  async function readOwned(key: string, expectedSize: number, expectedHash: string) {
    if (!deps.objects.read) throw new OwnedSessionError("storage_unavailable");
    const head = await deps.objects.head(key);
    if (head === null) return false;
    if (head.size !== expectedSize) throw new Error("Copy observation size mismatch");
    const bytes = await deps.objects.read(key, 4 * 1024 * 1024);
    if (bytes.byteLength !== expectedSize || sha(bytes) !== expectedHash)
      throw new Error("Copy observation digest mismatch");
    return true;
  }
  async function file(intentId: string, work: AskAttachmentFileWork, attemptId: string) {
    let frozenKey = work.objectKey,
      frozenHash = work.sha256;
    if (!validLegacyAskClaimKey(work.sourceId, work.questionId, work.sourceKey))
      throw new Error("Invalid source observation");
    if (work.state === "uploading") {
      const bytes = await deps.readLegacy(work.sourceId, work.questionId, work.sourceKey);
      if (bytes.byteLength !== work.size || bytes.byteLength > 4 * 1024 * 1024)
        throw new Error("Source observation size mismatch");
      const expectedHash = sha(bytes),
        copyAttemptId = createId();
      const selected = await call<unknown>("beginAttachmentCopy", {
        intentId,
        fileId: work.fileId,
        copyAttemptId,
        sha256: expectedHash,
        observedBytes: bytes.byteLength,
      });
      if (selected === null) return;
      const parsed = askAttachmentCopyGrantSchema.safeParse(selected);
      if (!parsed.success) throw new OwnedSessionError("storage_unavailable");
      const grant = parsed.data,
        prefix = `askmeatsack/owned/${work.sourceId}/claim/${attemptId}/${work.fileId}/${copyAttemptId}`;
      if (
        grant.fileId !== work.fileId ||
        grant.copyAttemptId !== copyAttemptId ||
        grant.sha256 !== expectedHash ||
        grant.size !== work.size ||
        grant.uploadKey !== `${prefix}/upload` ||
        grant.objectKey !== `${prefix}/sealed/content` ||
        now() >= grant.deadlineAt
      )
        throw new OwnedSessionError("storage_unavailable");
      frozenKey = grant.objectKey;
      frozenHash = expectedHash;
      await deps.objects.put(grant.uploadKey, bytes, work.contentType);
      if (now() >= grant.deadlineAt) return;
      await deps.objects.copy(grant.uploadKey, grant.objectKey);
      if (now() >= grant.deadlineAt || !(await readOwned(grant.objectKey, work.size, expectedHash)))
        return;
      await call("confirmAttachmentCopy", {
        intentId,
        fileId: work.fileId,
        copyAttemptId,
        sha256: expectedHash,
        observedBytes: work.size,
      });
    } else if (work.state === "copying") {
      // Retried processors receive a read-only reconciliation grant, never a second writer lease.
      if (
        !work.objectKey ||
        !work.sha256 ||
        !work.copyAttemptId ||
        !work.copyDeadlineAt ||
        now() >= work.copyDeadlineAt ||
        !(await readOwned(work.objectKey, work.size, work.sha256))
      )
        return;
      await call("confirmAttachmentCopy", {
        intentId,
        fileId: work.fileId,
        copyAttemptId: work.copyAttemptId,
        sha256: work.sha256,
        observedBytes: work.size,
      });
    }
    const selected = await call<unknown>("beginAttachmentScan", {
      intentId,
      fileId: work.fileId,
      scanAttemptId: createId(),
    });
    if (selected === null) return;
    const parsed = askAttachmentScanGrantSchema.safeParse(selected);
    if (!parsed.success) throw new OwnedSessionError("storage_unavailable");
    const grant = parsed.data;
    if (
      grant.fileId !== work.fileId ||
      grant.size !== work.size ||
      grant.objectKey !== frozenKey ||
      grant.sha256 !== frozenHash ||
      !grant.objectKey.startsWith(
        `askmeatsack/owned/${work.sourceId}/claim/${attemptId}/${work.fileId}/`,
      ) ||
      now() >= grant.deadlineAt
    )
      return;
    if (grant.handle) {
      const result = await deps.cleanroom.poll(grant.handle);
      if (result) {
        if (result.handle !== grant.handle) throw new OwnedSessionError("storage_unavailable");
        await apply(result);
      }
      return;
    }
    const result = await deps.cleanroom.submit({
      url: await deps.objects.scanUrl(grant.objectKey),
      declaredSizeBytes: work.size,
      callbackUrl: `${deps.callbackBaseUrl.replace(/\/$/, "")}/api/v1/claims/scan-result`,
      submissionKey: `ask-claim:${intentId}:${work.fileId}:${grant.scanAttemptId}`,
    });
    if (typeof result.handle !== "string" || !result.handle || result.handle.length > 256)
      throw new OwnedSessionError("storage_unavailable");
    if (
      await call<boolean>("registerAttachmentScan", {
        intentId,
        fileId: work.fileId,
        scanAttemptId: grant.scanAttemptId,
        handle: result.handle,
      })
    )
      await apply(result);
  }
  return {
    async begin(binding: AskClaimBinding, snapshotHash: string, session: string) {
      const value = await call<unknown>("beginAttachmentClaim", {
        ...binding,
        snapshotHash,
        session,
      });
      const result = askAttachmentReceiptSchema.safeParse(value);
      if (
        !result.success ||
        result.data.sourceId !== binding.sourceId ||
        result.data.attemptId !== binding.attemptId ||
        result.data.snapshotHash !== snapshotHash
      )
        throw new OwnedSessionError("storage_unavailable");
      return result.data;
    },
    async process(intentId: string) {
      const value = await call<unknown>("attachmentClaimWork", { intentId });
      if (value === null) return false;
      const parsed = askAttachmentWorkSchema.safeParse(value);
      if (!parsed.success) throw new OwnedSessionError("storage_unavailable");
      const work = parsed.data;
      if (work.files?.some((item) => item.sourceId !== work.sourceId))
        throw new OwnedSessionError("storage_unavailable");
      if (["committed", "aborted"].includes(work.state)) return true;
      if (now() >= work.deadlineAt!) return false;
      const results = await Promise.allSettled(
        work.files!.map((item) => file(intentId, item, work.attemptId)),
      );
      if (results.some((result) => result.status === "rejected"))
        throw new OwnedSessionError("storage_unavailable");
      // Only the authoritative native transaction may publish after every independent file is clean.
      await call("commitAttachmentClaim", { intentId });
      return true;
    },
    async callback(body: string, signature: string | null) {
      if (!deps.cleanroom.verifyCallback(body, signature)) return false;
      const raw: unknown = JSON.parse(body);
      const result = raw && typeof raw === "object" && "data" in raw ? raw.data : raw;
      if (
        !result ||
        typeof result !== "object" ||
        !("handle" in result) ||
        typeof result.handle !== "string" ||
        result.handle.length > 256 ||
        !("verdict" in result) ||
        !result.verdict ||
        typeof result.verdict !== "object" ||
        !("verdict" in result.verdict) ||
        !["clean", "infected", "failed", "too-large"].includes(String(result.verdict.verdict))
      )
        return false;
      return call<boolean>("applyAttachmentScan", {
        handle: result.handle,
        status:
          result.verdict.verdict === "clean"
            ? "clean"
            : result.verdict.verdict === "infected"
              ? "infected"
              : "failed",
      });
    },
  };
}
export type AskAttachmentClaims = ReturnType<typeof createAskAttachmentClaims>;
export function defaultAskAttachmentClaims(): AskAttachmentClaims | null {
  const metadata = defaultAskMetadata(),
    objects = defaultOwnedAnswerObjects(),
    readLegacy = defaultLegacyAskClaimReader(),
    cleanroom = readCleanroomConfig();
  return metadata && objects && readLegacy && cleanroom
    ? createAskAttachmentClaims({
        metadata,
        objects,
        readLegacy,
        cleanroom: createHttpCleanroom(cleanroom),
        callbackBaseUrl:
          process.env.CLEANROOM_CALLBACK_BASE_URL ??
          process.env.PUBLIC_BASE_URL ??
          "https://ask.imeatsack.com",
      })
    : null;
}
