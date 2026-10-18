import { z } from "zod";
import { askClaimBindingSchema } from "./ask-claim-protocol";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const time = z.number().int().nonnegative();
const size = z
  .number()
  .int()
  .nonnegative()
  .max(4 * 1024 * 1024);
const key = z.string().min(1).max(1024);
const intent = z.object({ intentId: id }).strict();
const file = intent.extend({ fileId: id }).strict();
const copy = file.extend({ copyAttemptId: uuid, sha256: hash, observedBytes: size }).strict();
export const ASK_ATTACHMENT_INPUTS = {
  beginAttachmentClaim: askClaimBindingSchema
    .extend({
      snapshotHash: hash,
      session: z
        .string()
        .min(2)
        .max(4 * 1024 * 1024),
    })
    .strict(),
  attachmentClaimWork: intent,
  getAttachmentClaim: intent,
  beginAttachmentCopy: copy,
  confirmAttachmentCopy: copy,
  beginAttachmentScan: file.extend({ scanAttemptId: uuid }).strict(),
  registerAttachmentScan: file
    .extend({ scanAttemptId: uuid, handle: z.string().min(1).max(256) })
    .strict(),
  applyAttachmentScan: z
    .object({ handle: z.string().min(1).max(256), status: z.enum(["clean", "infected", "failed"]) })
    .strict(),
  commitAttachmentClaim: intent,
  abortAttachmentClaim: intent,
};
export const askAttachmentReceiptSchema = z
  .object({
    state: z.enum(["copying", "scanning", "committed", "aborted"]),
    sourceId: id,
    id,
    attemptId: uuid,
    snapshotHash: hash,
    cleanupPending: z.boolean(),
  })
  .strict()
  .refine((value) => value.id === value.sourceId);
export type AskAttachmentReceipt = z.infer<typeof askAttachmentReceiptSchema>;
const receipt = z.object({
  state: z.enum(["copying", "scanning", "committed", "aborted"]),
  sourceId: id,
  id,
  attemptId: uuid,
  snapshotHash: hash,
  cleanupPending: z.boolean(),
});
const workFile = z
  .object({
    fileId: id,
    questionId: z.string().min(1).max(128),
    sourceId: id,
    sourceKey: key,
    size,
    contentType: z.string().min(1).max(255),
    state: z.enum(["uploading", "copying", "sealed"]),
    uploadKey: key.optional(),
    objectKey: key.optional(),
    sha256: hash.optional(),
    copyAttemptId: uuid.optional(),
    copyDeadlineAt: time.optional(),
    scanAttemptId: uuid.optional(),
    scanHandle: z.string().min(1).max(256).optional(),
    scanDeadlineAt: time.optional(),
    scanStatus: z.string().max(32).optional(),
  })
  .strict();
export const askAttachmentWorkSchema = receipt
  .extend({ deadlineAt: time.optional(), files: z.array(workFile).max(5).optional() })
  .strict()
  .refine(
    (value) =>
      value.id === value.sourceId &&
      (["copying", "scanning"].includes(value.state)
        ? value.deadlineAt !== undefined && value.files !== undefined
        : value.files === undefined),
  );
export type AskAttachmentWork = z.infer<typeof askAttachmentWorkSchema>;
export type AskAttachmentFileWork = z.infer<typeof workFile>;
export const askAttachmentCopyGrantSchema = z
  .object({
    fileId: id,
    copyAttemptId: uuid,
    uploadKey: key,
    objectKey: key,
    sha256: hash,
    size,
    deadlineAt: time,
  })
  .strict();
export const askAttachmentScanGrantSchema = z
  .object({
    fileId: id,
    objectKey: key,
    sha256: hash,
    scanAttemptId: uuid,
    handle: z.string().min(1).max(256).optional(),
    deadlineAt: time,
    size,
  })
  .strict();
const segment = (value: string, max: number) => {
  const clean = value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, max);
  return !clean || /^\.+$/.test(clean) ? "_" : clean;
};

export function validLegacyAskClaimKey(
  sourceId: string,
  questionId: string,
  sourceKey: string,
): boolean {
  const prefix = `askmeatsack/${segment(sourceId, 64)}/${segment(questionId, 64)}/`;
  return (
    !["owned", "kept"].includes(sourceId) &&
    sourceKey.startsWith(prefix) &&
    /^[A-Za-z0-9._-]+$/.test(sourceKey.slice(prefix.length)) &&
    !/^\.+$/.test(sourceKey.slice(prefix.length))
  );
}
