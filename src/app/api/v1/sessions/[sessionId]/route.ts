import {
  getDefaultSessionService,
  jsonError,
  jsonServiceError,
  readCreateCredential,
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
  const credential = readCreateCredential(request);
  const token = new URL(request.url).searchParams.get("token") ?? undefined;

  const result = await getDefaultSessionService().getForAgent({
    sessionId,
    agentToken: token,
    hasCreateCredential: credential.hasCreateCredential,
  });

  if (isSessionServiceError(result)) {
    return jsonServiceError(result);
  }

  return Response.json(result);
}

export async function PATCH(
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

  const result = await getDefaultSessionService().update({
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
