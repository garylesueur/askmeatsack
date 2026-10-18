import { randomUUID } from "node:crypto";
import {
  createHttpCleanroom,
  readCleanroomConfig,
  type Cleanroom,
  type ScanSubmitResult,
} from "./ask-cleanroom";
import { defaultOwnedAnswerObjects, type AskObjects } from "./owned-answer-objects";
import {
  defaultAskMetadata,
  OwnedSessionError,
  type AskMetadata,
  type AskKeptFile,
  type OwnedEnvelope,
} from "./owned-session-metadata";

export type OwnedAnswerFiles = ReturnType<typeof createOwnedAnswerFiles>;
function date(value: string | number | undefined) {
  return value === undefined ? null : new Date(value).toISOString();
}
export function safeKeptFile(file: AskKeptFile) {
  const available = file.status === "available" || file.status === "kept";
  return {
    id: file.id,
    name: file.name,
    type: file.contentType,
    size: file.size,
    createdAt: date(file.createdAt),
    uploadedAt: date(file.receivedAt),
    retainedUntil: null,
    scanStatus: available ? "clean" : "pending",
    canRead: available,
    canKeep: false,
    canRemove: true,
    canRetryScan: false,
    status: file.status,
    ...(file.sourceRequestId ? { sourceRequestId: file.sourceRequestId } : {}),
    ...(file.sourceFileId ? { sourceFileId: file.sourceFileId } : {}),
  };
}
export function createOwnedAnswerFiles(deps: {
  metadata: AskMetadata;
  objects: AskObjects;
  cleanroom: Cleanroom;
  publicBaseUrl: string;
  callbackBaseUrl?: string;
  now?: () => number;
  createId?: () => string;
}) {
  const now = deps.now ?? Date.now;
  const createId = deps.createId ?? randomUUID;
  const call = deps.metadata.call.bind(deps.metadata);
  async function apply(scanResult: ScanSubmitResult) {
    if (!scanResult.verdict) return;
    // Ask never accepts a skipped scan as clean, including the too-large verdict.
    const verdict = scanResult.verdict;
    const status =
      verdict.verdict === "clean"
        ? "clean"
        : verdict.verdict === "infected"
          ? "infected"
          : "failed";
    await call("applyScan", {
      handle: scanResult.handle,
      status,
      ...(verdict.verdict === "failed"
        ? {
            reason: (typeof verdict.reason === "string" ? verdict.reason : "Scan failed").slice(
              0,
              255,
            ),
          }
        : verdict.verdict === "too-large"
          ? { reason: "Attachment was not scanned" }
          : {}),
    });
  }
  async function scan(fileId: string, size: number) {
    const attemptId = createId();
    const grant = await call<{
      fileId: string;
      objectKey: string;
      attemptId: string;
      deadlineAt: number;
      handle?: string;
      status: string;
    } | null>("beginScan", { fileId, attemptId });
    if (!grant) return false;
    if (grant.handle) {
      const result = await deps.cleanroom.poll(grant.handle);
      if (result) await apply(result);
      return true;
    }
    if (now() >= grant.deadlineAt) return false;
    const result = await deps.cleanroom.submit({
      url: await deps.objects.scanUrl(grant.objectKey),
      declaredSizeBytes: size,
      callbackUrl: `${(deps.callbackBaseUrl ?? deps.publicBaseUrl).replace(/\/$/, "")}/api/v1/cleanroom/callback`,
      submissionKey: `${fileId}:${grant.attemptId}`,
    });
    const registered = await call<boolean>("registerScan", {
      fileId,
      attemptId: grant.attemptId,
      handle: result.handle,
    });
    if (registered) await apply(result);
    return registered;
  }
  return {
    scan,
    async upload(input: {
      id: string;
      questionId: string;
      filename: string;
      contentType: string;
      bytes: Uint8Array;
      publicToken: string;
    }) {
      if (!deps.cleanroom.available()) throw new OwnedSessionError("files_unavailable");
      if (input.filename.length > 255 || input.contentType.length > 255)
        throw new OwnedSessionError(
          "invalid_upload",
          400,
          "Attachment names and types must be at most 255 characters.",
        );
      const fileId = createId();
      const attemptId = createId();
      const reservation = await call<{
        fileId: string;
        uploadKey: string;
        writeDeadlineAt: number;
      }>("reserveUpload", {
        id: input.id,
        fileId,
        questionId: input.questionId,
        filename: input.filename,
        contentType: input.contentType,
        size: input.bytes.byteLength,
        writeDeadlineAt: now() + 120_000,
      });
      try {
        if (now() >= reservation.writeDeadlineAt) throw new Error("Upload lease expired");
        await deps.objects.put(reservation.uploadKey, input.bytes, input.contentType);
        const grant = await call<{
          uploadKey: string;
          objectKey: string;
          attemptId: string;
          deadlineAt: number;
        } | null>("beginSeal", { id: input.id, fileId, attemptId });
        if (!grant || now() >= grant.deadlineAt) throw new Error("Seal lease unavailable");
        const staging = await deps.objects.head(grant.uploadKey);
        if (staging?.size !== input.bytes.byteLength) throw new Error("Upload size mismatch");
        await deps.objects.copy(grant.uploadKey, grant.objectKey);
        const sealed = await deps.objects.head(grant.objectKey);
        if (sealed?.size !== input.bytes.byteLength) throw new Error("Sealed size mismatch");
        const url = `${deps.publicBaseUrl.replace(/\/$/, "")}/api/v1/sessions/${input.id}/files/${fileId}?t=${encodeURIComponent(input.publicToken)}`;
        const committed = await call<OwnedEnvelope | null>("commitSeal", {
          id: input.id,
          fileId,
          attemptId,
          observedBytes: sealed.size,
          url,
        });
        if (!committed) throw new OwnedSessionError("conflict", 409);
      } catch (error) {
        // Backend stores immutable cleanup keys/deadlines; never infer write completion from abort.
        try {
          await call("failSeal", { id: input.id, fileId, attemptId });
        } catch {
          /* durable expiry worker also owns cleanup */
        }
        throw error;
      }
      // Scanner outage blocks reads but must not undo an already committed answer attachment.
      try {
        await scan(fileId, input.bytes.byteLength);
      } catch {
        /* lease and callback/poll recovery remain durable */
      }
      return { fileId };
    },
    async keep(input: { accountId: string; requestId: string; fileId: string; id: string }) {
      const attemptId = createId();
      const grant = await call<{
        status: "copying" | "kept";
        file: AskKeptFile;
        sourceKey?: string;
        objectKey?: string;
        attemptId?: string;
        deadlineAt?: number;
      }>("beginKeep", { ...input, attemptId });
      if (grant.status === "kept")
        return { file: safeKeptFile(grant.file), status: "kept" as const };
      if (grant.attemptId !== attemptId) throw new OwnedSessionError("conflict", 409);
      try {
        if (
          !grant.sourceKey ||
          !grant.objectKey ||
          grant.attemptId !== attemptId ||
          !grant.deadlineAt ||
          now() >= grant.deadlineAt
        )
          throw new OwnedSessionError("conflict", 409);
        await deps.objects.copy(grant.sourceKey, grant.objectKey);
        const head = await deps.objects.head(grant.objectKey);
        if (head?.size !== grant.file.size) throw new Error("Kept copy size mismatch");
        const result = await call<AskKeptFile | null>("commitKeep", {
          ...input,
          attemptId,
          observedBytes: head.size,
        });
        if (!result) throw new OwnedSessionError("conflict", 409);
        return { file: safeKeptFile(result), status: "kept" as const };
      } catch (error) {
        try {
          await call("abortKeep", input);
        } catch {
          /* cleanup expiry remains durable */
        }
        throw error;
      }
    },
    async callback(payload: string, signature: string | null) {
      if (!deps.cleanroom.verifyCallback(payload, signature)) return false;
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return false;
      }
      const data = parsed && typeof parsed === "object" && "data" in parsed ? parsed.data : parsed;
      if (
        !data ||
        typeof data !== "object" ||
        !("handle" in data) ||
        typeof data.handle !== "string"
      )
        return false;
      const scanResult = data as ScanSubmitResult;
      if (
        !scanResult.verdict ||
        !["clean", "infected", "too-large", "failed"].includes(scanResult.verdict.verdict)
      )
        return false;
      const authority = await call("lookupScan", { handle: scanResult.handle });
      if (authority) await apply(scanResult);
      return true;
    },
  };
}
export function defaultOwnedAnswerFiles(): OwnedAnswerFiles | null {
  const metadata = defaultAskMetadata();
  const objects = defaultOwnedAnswerObjects();
  const config = readCleanroomConfig();
  return metadata && objects && config
    ? createOwnedAnswerFiles({
        metadata,
        objects,
        cleanroom: createHttpCleanroom(config),
        publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "https://ask.imeatsack.com",
        callbackBaseUrl: process.env.CLEANROOM_CALLBACK_BASE_URL,
      })
    : null;
}
