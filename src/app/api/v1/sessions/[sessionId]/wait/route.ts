import {
  getDefaultSessionService,
  jsonError,
  readCreateCredential,
} from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";

export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
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
    return jsonError(result.status, result.code, result.message);
  }
  return Response.json(result);
}
