import { createHmac } from "node:crypto";
import {
  askClaimImportSchema,
  askClaimLookupSchema,
  askClaimReceiptSchema,
} from "./ask-claim-protocol";
import { ASK_ATTACHMENT_INPUTS } from "./ask-attachment-protocol";

export type AskMetadataOperation =
  | keyof typeof ASK_ATTACHMENT_INPUTS
  | "claimRequest"
  | "getClaim"
  | "recordShare"
  | "create"
  | "getById"
  | "compareAndSave"
  | "listByOwner"
  | "delete"
  | "fileAccess"
  | "allowance"
  | "reserveUpload"
  | "beginSeal"
  | "commitSeal"
  | "failSeal"
  | "beginScan"
  | "registerScan"
  | "lookupScan"
  | "applyScan"
  | "beginKeep"
  | "commitKeep"
  | "abortKeep"
  | "listKept"
  | "getKept"
  | "removeKept"
  | "authorizeCleanup"
  | "releaseCleanup";

export class OwnedSessionError extends Error {
  constructor(
    public code: string,
    public status = 503,
    message?: string,
  ) {
    super(
      message ??
        (code === "canonical_too_large"
          ? "This questionnaire and its permitted answers exceed the account storage limit. Reduce its content before creating it."
          : code === "request_capacity"
            ? "Your account holds 500 requests. Remove a request and wait for its attachment cleanup before creating another."
            : code === "storage_capacity"
              ? "Your Ask storage allowance is full. Remove an attachment or kept file before trying again."
              : code === "recovery_busy"
                ? "Earlier uploads are still being cleaned up. Try again shortly."
                : code === "keep_retry_required"
                  ? "The earlier copy attempt was removed. Retry to create a new kept copy."
                  : code === "conflict"
                    ? "This request changed. Reload it before trying again."
                    : code === "terminal_request"
                      ? "This request is closed. Reload it to see its current state."
                      : ["invalid_upload", "invalid_file", "ineligible_file"].includes(code)
                        ? "This attachment is no longer eligible. Reload the request before trying again."
                        : code === "invalid_answer"
                          ? "This answer is not usable for the current request. Reload and try again."
                          : "Account request storage is unavailable. Try again later."),
    );
  }
}
export type OwnedEnvelope = { session: string; revision: number };
export type AskAllowance = {
  requests: number;
  requestLimit: number;
  bytes: number;
  byteLimit: number;
};
export type AskFileAccess = {
  fileIds: string[];
  files: Record<
    string,
    { state: string; scanStatus: string; uploadedAt?: string; retainedUntil?: string }
  >;
  keptFiles: Record<string, string>;
};
export type AskKeptFile = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  createdAt: number | string;
  status: string;
  sourceRequestId?: string;
  sourceFileId?: string;
  receivedAt?: number | string;
  keptAt?: number | string;
  objectKey?: string;
};
export type AskMetadata = {
  call<T>(operation: AskMetadataOperation, input: Record<string, unknown>): Promise<T>;
};
export function createAskMetadata(deps: {
  url: string;
  secret: string;
  fetch?: typeof fetch;
  now?: () => number;
}): AskMetadata {
  const url = new URL("/api/v1/asks/store", deps.url);
  const send = deps.fetch ?? fetch;
  return {
    async call<T>(operation: AskMetadataOperation, input: Record<string, unknown>): Promise<T> {
      if (!deps.secret) throw new OwnedSessionError("storage_unavailable");
      if (
        Object.hasOwn(ASK_ATTACHMENT_INPUTS, operation) &&
        !ASK_ATTACHMENT_INPUTS[operation as keyof typeof ASK_ATTACHMENT_INPUTS].safeParse(input)
          .success
      )
        throw new OwnedSessionError("storage_unavailable");
      if (
        ["claimRequest", "getClaim"].includes(operation) &&
        !(operation === "claimRequest" ? askClaimImportSchema : askClaimLookupSchema).safeParse(
          input,
        ).success
      )
        throw new OwnedSessionError("storage_unavailable");
      const body = JSON.stringify({ operation, input });
      const timestamp = Math.floor((deps.now?.() ?? Date.now()) / 1000);
      const signature = createHmac("sha256", deps.secret)
        .update(`${timestamp}.askmeatsack-account-store.${body}`)
        .digest("hex");
      let response: Response;
      try {
        response = await send(url, {
          method: "POST",
          body,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(60_000),
          headers: {
            "Content-Type": "application/json",
            "ask-store-signature": `t=${timestamp},v1=${signature}`,
          },
        });
      } catch {
        throw new OwnedSessionError("storage_unavailable");
      }
      let result: unknown;
      try {
        result = await response.json();
      } catch {
        throw new OwnedSessionError("storage_unavailable");
      }
      if (!response.ok) {
        const code =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "storage_unavailable";
        const safe = new Set([
          "recovery_busy",
          "keep_retry_required",
          "canonical_too_large",
          "request_capacity",
          "storage_capacity",
          "conflict",
          "immutable_request",
          "terminal_request",
          "invalid_upload",
          "ineligible_file",
          "invalid_file",
          "invalid_answer",
          "claim_files_unsupported",
        ]);
        throw new OwnedSessionError(
          safe.has(code) ? code : "storage_unavailable",
          safe.has(code) ? response.status : 503,
        );
      }
      if (operation === "claimRequest" || operation === "getClaim") {
        if (result === null) return result as T;
        const receipt = askClaimReceiptSchema.safeParse(result);
        if (
          !receipt.success ||
          receipt.data.sourceId !== input.sourceId ||
          receipt.data.snapshotHash !== input.snapshotHash ||
          (operation === "claimRequest" && receipt.data.attemptId !== input.attemptId)
        )
          throw new OwnedSessionError("storage_unavailable");
        if (receipt.data.request) {
          let request: unknown;
          try {
            request = JSON.parse(receipt.data.request.session);
          } catch {
            throw new OwnedSessionError("storage_unavailable");
          }
          if (
            !request ||
            typeof request !== "object" ||
            !("id" in request) ||
            request.id !== input.sourceId ||
            !("ownerAccountId" in request) ||
            request.ownerAccountId !== input.accountId
          )
            throw new OwnedSessionError("storage_unavailable");
        }
        return receipt.data as T;
      }
      return result as T;
    },
  };
}
export function defaultAskMetadata(): AskMetadata | null {
  const secret = process.env.ASK_METADATA_SECRET?.trim();
  if (!secret) return null;
  return createAskMetadata({
    url: process.env.LANYARD_URL ?? "https://meatsack.puregaz.com",
    secret,
  });
}
export function askUsage(value: AskAllowance) {
  return {
    retainedRequests: value.requests,
    requestAllowance: value.requestLimit,
    usedBytes: value.bytes,
    allowanceBytes: value.byteLimit,
  };
}
