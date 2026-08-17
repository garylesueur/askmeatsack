import {
  getDefaultSessionService,
  jsonError,
  readPublicToken,
} from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { sessionId } = await context.params;
  const result = await getDefaultSessionService().markdownForPublic({
    sessionId,
    publicToken: readPublicToken(request),
  });
  if (isSessionServiceError(result)) {
    return jsonError(result.status, result.code, result.message);
  }
  return new Response(result, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
