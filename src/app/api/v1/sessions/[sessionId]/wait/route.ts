import {
  getDefaultSessionService,
  jsonError,
  jsonServiceError,
  readCreateCredential,
} from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";

// Mirrors WAIT_FUNCTION_MAX_SECONDS in src/lib/schema.ts; a route segment
// config must be a literal, so it cannot import it. wait-budget.test.ts fails
// if they drift. A wait sits for WAIT_BUDGET_SECONDS, leaving room to answer
// inside this limit rather than being killed on the wire.
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { sessionId } = await context.params;
  const credential = readCreateCredential(request);
  const token = new URL(request.url).searchParams.get("token") ?? undefined;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Body must be JSON");
  }

  const result = await getDefaultSessionService().wait({
    sessionId,
    agentToken: token,
    hasCreateCredential: credential.hasCreateCredential,
    body,
  });
  if (isSessionServiceError(result)) {
    return jsonServiceError(result);
  }
  return Response.json(result);
}
