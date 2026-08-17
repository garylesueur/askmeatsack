import {
  getDefaultSessionService,
  jsonError,
  readPublicToken,
} from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";

type RouteContext = {
  params: Promise<{ sessionId: string; questionId: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { sessionId, questionId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Body must be JSON");
  }

  const result = await getDefaultSessionService().saveAnswer({
    sessionId,
    questionId,
    publicToken: readPublicToken(request),
    body,
  });
  if (isSessionServiceError(result)) {
    return jsonError(result.status, result.code, result.message);
  }
  return Response.json(result);
}
