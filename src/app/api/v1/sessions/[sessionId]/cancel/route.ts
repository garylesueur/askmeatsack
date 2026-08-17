import {
  getDefaultSessionService,
  jsonServiceError,
  readCreateCredential,
  readPublicToken,
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
  const token = readPublicToken(request);

  const result = await getDefaultSessionService().cancel({
    sessionId,
    publicToken: token,
    agentToken: token,
    hasCreateCredential: credential.hasCreateCredential,
  });
  if (isSessionServiceError(result)) {
    return jsonServiceError(result);
  }
  return Response.json(result);
}
