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

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { sessionId } = await context.params;
  const credential = readCreateCredential(request);
  const token = new URL(request.url).searchParams.get("token") ?? undefined;
  let body: unknown = {};
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_json", "Body must be JSON");
    }
  }

  const result = await getDefaultSessionService().sendEmail({
    sessionId,
    agentToken: token ?? undefined,
    hasCreateCredential: credential.hasCreateCredential,
    body,
  });
  if (isSessionServiceError(result)) {
    return jsonServiceError(result);
  }
  return Response.json(result);
}
