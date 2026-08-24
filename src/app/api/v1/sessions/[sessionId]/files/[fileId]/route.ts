import {
  getDefaultSessionService,
  jsonError,
  jsonServiceError,
  readPublicToken,
} from "@/lib/app-sessions";
import {
  contentDispositionFilename,
  fetchAnswerFile,
  bytesFromInlineKey,
  isInlineFileKey,
  storageKeyFromFile,
} from "@/lib/answer-files";
import { isSessionServiceError } from "@/lib/sessions";

type RouteContext = {
  params: Promise<{ sessionId: string; fileId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { sessionId, fileId } = await context.params;
  const result = await getDefaultSessionService().readPublicFile({
    sessionId,
    publicToken: readPublicToken(request),
    fileId,
  });
  if (isSessionServiceError(result)) {
    return jsonServiceError(result);
  }

  const key = storageKeyFromFile(result);
  if (!key) {
    return jsonError(404, "not_found", "File was not found");
  }
  if (isInlineFileKey(key)) {
    const bytes = bytesFromInlineKey(key);
    if (!bytes) {
      return jsonError(404, "not_found", "File was not found");
    }
    const headers = new Headers();
    headers.set("Content-Type", result.contentType || "application/octet-stream");
    headers.set("Content-Disposition", contentDispositionFilename(result.filename));
    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("Content-Length", String(bytes.length));
    return new Response(Uint8Array.from(bytes), { status: 200, headers });
  }

  let stored: Response;
  try {
    stored = await fetchAnswerFile(key);
  } catch (error) {
    console.error("R2 download failed", error instanceof Error ? error.message : "unknown error");
    return jsonError(502, "files_unavailable", "File storage refused the download");
  }

  const headers = new Headers();
  headers.set("Content-Type", result.contentType || "application/octet-stream");
  headers.set("Content-Disposition", contentDispositionFilename(result.filename));
  headers.set("Cache-Control", "private, max-age=3600");
  const length = stored.headers.get("Content-Length");
  if (length) {
    headers.set("Content-Length", length);
  }

  return new Response(stored.body, {
    status: 200,
    headers,
  });
}
