import { getDefaultSessionService, jsonServiceError, readPublicToken } from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { sessionId } = await context.params;
  const result = await getDefaultSessionService().submit({
    sessionId,
    publicToken: readPublicToken(request),
  });
  if (isSessionServiceError(result)) {
    return jsonServiceError(result);
  }
  return Response.json(result);
}
