import { z } from "zod";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const accountId = z.string().regex(/^[A-Za-z0-9_-]{1,256}$/);
const attemptId = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const askClaimIdentitySchema = z
  .object({ accountId, sourceId: id, attemptId, proofHash: hash })
  .strict();
export const askClaimBindingSchema = askClaimIdentitySchema.extend({ intentId: id }).strict();
export type AskClaimIdentity = z.infer<typeof askClaimIdentitySchema>;
export type AskClaimBinding = z.infer<typeof askClaimBindingSchema>;
export const askClaimIntentSchema = askClaimBindingSchema
  .extend({
    product: z.literal("askmeatsack"),
    state: z.enum(["prepared", "started", "committed", "aborted"]),
    createdAt: z.number().int().nonnegative(),
    deadlineAt: z.number().int().nonnegative(),
    sourceResolved: z.boolean(),
  })
  .strict();
export type AskClaimIntent = z.infer<typeof askClaimIntentSchema>;
export const askClaimResolutionSchema = askClaimBindingSchema
  .extend({ product: z.literal("askmeatsack"), outcome: z.enum(["aborted", "committed"]) })
  .strict();
export type AskClaimResolution = z.infer<typeof askClaimResolutionSchema>;
export const askClaimImportSchema = askClaimBindingSchema
  .extend({
    snapshotHash: hash,
    session: z
      .string()
      .min(2)
      .max(4 * 1024 * 1024),
  })
  .strict();
export const askClaimLookupSchema = z
  .object({ accountId, sourceId: id, snapshotHash: hash })
  .strict();
export const askClaimReceiptSchema = z
  .object({
    state: z.literal("committed"),
    id,
    sourceId: id,
    attemptId,
    snapshotHash: hash,
    request: z
      .object({ session: z.string(), revision: z.number().int().nonnegative() })
      .strict()
      .nullable(),
  })
  .strict()
  .refine((receipt) => receipt.id === receipt.sourceId);
export type AskClaimReceipt = z.infer<typeof askClaimReceiptSchema>;
