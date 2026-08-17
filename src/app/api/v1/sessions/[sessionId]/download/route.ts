import {
  getDefaultSessionService,
  jsonServiceError,
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
  const result = await getDefaultSessionService().downloadForPublic({
    sessionId,
    publicToken: readPublicToken(request),
  });
  if (isSessionServiceError(result)) {
    return jsonServiceError(result);
  }
  return new Response(JSON.stringify(result, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="answers.json"',
    },
  });
}
