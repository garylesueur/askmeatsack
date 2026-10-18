import { accountResponse, accountUnauthorized, verifyAccountRequest } from "./account-sessions";
import { jsonError, jsonServiceError } from "./app-sessions";
import { contentDispositionFilename, fetchAnswerFile } from "./answer-files";
import {
  defaultAskMetadata,
  OwnedSessionError,
  askUsage,
  type AskMetadata,
  type AskAllowance,
  type AskKeptFile,
} from "./owned-session-metadata";
import { defaultOwnedAnswerFiles, safeKeptFile } from "./owned-answer-files";
import { isSessionServiceError } from "./sessions";

export async function accountAction(
  request: Request,
  run: (account: string) => Promise<unknown>,
): Promise<Response> {
  const authority = await verifyAccountRequest(request);
  if (authority.outcome !== "accepted") return accountUnauthorized();
  try {
    const value = await run(authority.account);
    return accountResponse(
      value instanceof Response
        ? value
        : isSessionServiceError(value)
          ? jsonServiceError(value)
          : Response.json(value),
    );
  } catch (error) {
    return accountResponse(
      error instanceof OwnedSessionError
        ? jsonServiceError(error)
        : jsonError(
            503,
            "storage_unavailable",
            "Account request storage is unavailable. Try again later.",
          ),
    );
  }
}
export function requireAskMetadata(): AskMetadata {
  const metadata = defaultAskMetadata();
  if (!metadata) throw new OwnedSessionError("storage_unavailable");
  return metadata;
}
export async function proxyOwnerFile(file: {
  filename: string;
  contentType: string;
  key?: string;
}): Promise<Response> {
  if (!file.key) return jsonError(404, "not_found", "File was not found");
  const stored = await fetchAnswerFile(file.key);
  return new Response(stored.body, {
    headers: {
      "Content-Type": file.contentType || "application/octet-stream",
      "Content-Disposition": contentDispositionFilename(file.filename),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function keptFileActions() {
  const metadata = requireAskMetadata();
  return {
    async list(accountId: string, query: URLSearchParams) {
      const limit = query.get("limit");
      const cursor = query.get("cursor") ?? undefined;
      if ((limit && !/^[1-9]\d{0,2}$/.test(limit)) || (cursor && cursor.length > 4096))
        return jsonError(400, "invalid_page", "Page is invalid");
      const result = await metadata.call<{ files: AskKeptFile[]; nextCursor: string | null }>(
        "listKept",
        {
          accountId,
          cursor,
          search: query.get("search")?.slice(0, 200) || undefined,
          ...(limit ? { limit: Math.min(100, Number(limit)) } : {}),
        },
      );
      return {
        ...result,
        files: result.files.map(safeKeptFile),
        usage: askUsage(await metadata.call<AskAllowance>("allowance", { accountId })),
      };
    },
    async get(accountId: string, id: string, download = false) {
      const result = await metadata.call<AskKeptFile | null>("getKept", { accountId, id });
      if (!result) return jsonError(404, "not_found", "File was not found");
      const safe = safeKeptFile(result);
      if (!download) return safe;
      if (!safe.canRead || !result.objectKey)
        return jsonError(409, "file_unavailable", "This file is unavailable");
      return proxyOwnerFile({
        filename: result.name,
        contentType: result.contentType,
        key: result.objectKey,
      });
    },
    async remove(accountId: string, id: string) {
      const result = await metadata.call<{
        removed: true;
        cleanupPending?: boolean;
        pendingCleanup?: boolean;
      } | null>("removeKept", { accountId, id });
      return result
        ? { removed: true, pendingCleanup: result.cleanupPending ?? result.pendingCleanup ?? false }
        : jsonError(404, "not_found", "File was not found");
    },
    async keep(accountId: string, requestId: string, fileId: string, request: Request) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonError(400, "invalid_request", "Body must be JSON");
      }
      if (
        !body ||
        typeof body !== "object" ||
        !("id" in body) ||
        typeof body.id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)
      )
        return jsonError(400, "invalid_request", "A stable file id is required");
      const files = defaultOwnedAnswerFiles();
      if (!files) throw new OwnedSessionError("storage_unavailable");
      return files.keep({ accountId, requestId, fileId, id: body.id });
    },
  };
}
