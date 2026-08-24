import {
  getDefaultSessionService,
  jsonError,
  jsonServiceError,
  readPublicToken,
} from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";

// The callback retries run under `after`, which Next bounds by this route's own
// maxDuration. Without one, a retry budget of ~30s is cut off by the platform
// default and the hook is lost for exactly the receiver it was meant to survive.
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const { sessionId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Body must be JSON");
  }
  const result = await getDefaultSessionService().saveAnswers({
    sessionId,
    publicToken: readPublicToken(request),
    body,
  });
  if (isSessionServiceError(result)) {
    return jsonServiceError(result);
  }
  return Response.json(result);
}
