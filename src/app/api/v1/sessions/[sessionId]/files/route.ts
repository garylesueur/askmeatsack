import {
  getDefaultSessionService,
  jsonError,
  jsonServiceError,
  readPublicToken,
} from "@/lib/app-sessions";
import {
  fileStoreAvailable,
  fileTooLarge,
  inlineStorageKey,
  storeAnswerFile,
} from "@/lib/answer-files";
import { limitCreateFromRequest } from "@/lib/create-rate-limit";
import { FILE_MAX_BYTES } from "@/lib/schema";
import { isSessionServiceError } from "@/lib/sessions";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const limited = await limitCreateFromRequest(request);
  if (!limited.ok) {
    return jsonError(429, "rate_limited", "Too many uploads from this address. Try again later.");
  }

  const { sessionId } = await context.params;
  const url = new URL(request.url);
  const questionId = url.searchParams.get("questionId") ?? "";
  if (!questionId) {
    return jsonError(400, "invalid_answer", "questionId is required");
  }

  const service = getDefaultSessionService();
  const publicToken = readPublicToken(request);
  const refused = await service.canAcceptFile({
    sessionId,
    publicToken,
    questionId,
  });
  if (refused) {
    return jsonServiceError(refused);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "invalid_answer", "file is required");
  }
  if (fileTooLarge(file.size)) {
    return jsonError(400, "invalid_answer", `File must be at most ${FILE_MAX_BYTES} bytes`);
  }

  const view = await service.getForPublic({ sessionId, publicToken });
  if (isSessionServiceError(view)) {
    return jsonServiceError(view);
  }
  const question = view.questions.find((candidate) => candidate.id === questionId);
  const sketchPreview = question?.sketch === true;
  if (!fileStoreAvailable() && !sketchPreview) {
    return jsonError(503, "files_unavailable", "File storage is not configured");
  }

  let storageKey: string;
  if (fileStoreAvailable()) {
    try {
      const stored = await storeAnswerFile({
        sessionId,
        questionId,
        filename: file.name || "upload",
        body: file,
        contentType: file.type || "application/octet-stream",
      });
      storageKey = stored.pathname;
    } catch (error) {
      console.error("R2 upload failed", error instanceof Error ? error.message : "unknown error");
      return jsonError(502, "files_unavailable", "File storage refused the upload");
    }
  } else {
    const bytes = Buffer.from(await file.arrayBuffer());
    storageKey = inlineStorageKey(bytes);
  }

  const result = await service.attachFile({
    sessionId,
    publicToken,
    questionId,
    filename: file.name || "upload",
    contentType: file.type || "application/octet-stream",
    size: file.size,
    storageKey,
  });
  if (isSessionServiceError(result)) {
    return jsonServiceError(result);
  }
  return Response.json(result, { status: 201 });
}
