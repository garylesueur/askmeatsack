import {
  getDefaultSessionService,
  jsonError,
  readPublicToken,
} from "@/lib/app-sessions";
import {
  blobStoreAvailable,
  fileTooLarge,
  storeAnswerBlob,
} from "@/lib/answer-blob";
import { FILE_MAX_BYTES } from "@/lib/schema";
import { isSessionServiceError } from "@/lib/sessions";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!blobStoreAvailable()) {
    return jsonError(
      503,
      "files_unavailable",
      "File storage is not configured",
    );
  }
  const { sessionId } = await context.params;
  const url = new URL(request.url);
  const questionId = url.searchParams.get("questionId") ?? "";
  if (!questionId) {
    return jsonError(400, "invalid_answer", "questionId is required");
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "invalid_answer", "file is required");
  }
  if (fileTooLarge(file.size)) {
    return jsonError(
      400,
      "invalid_answer",
      `File must be at most ${FILE_MAX_BYTES} bytes`,
    );
  }

  const stored = await storeAnswerBlob({
    sessionId,
    questionId,
    filename: file.name || "upload",
    body: file,
    contentType: file.type || "application/octet-stream",
  });

  const result = await getDefaultSessionService().attachFile({
    sessionId,
    publicToken: readPublicToken(request),
    questionId,
    filename: file.name || "upload",
    contentType: file.type || "application/octet-stream",
    size: file.size,
    url: stored.url,
  });
  if (isSessionServiceError(result)) {
    return jsonError(result.status, result.code, result.message);
  }
  return Response.json(result, { status: 201 });
}
