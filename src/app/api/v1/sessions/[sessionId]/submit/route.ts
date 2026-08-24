import { getDefaultSessionService, jsonServiceError, readPublicToken } from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";

// The callback retries run under `after`, which Next bounds by this route's own
// maxDuration. Without one, a retry budget of ~30s is cut off by the platform
// default and the hook is lost for exactly the receiver it was meant to survive.
export const maxDuration = 60;

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
