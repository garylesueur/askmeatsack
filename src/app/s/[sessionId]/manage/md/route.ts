import {
  getDefaultSessionService,
  jsonServiceError,
  readCreateCredential,
} from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { sessionId } = await context.params;
  const credential = readCreateCredential(request);
  const token = new URL(request.url).searchParams.get("token") ?? undefined;
  const result = await getDefaultSessionService().markdownForManage({
    sessionId,
    agentToken: token,
    hasCreateCredential: credential.hasCreateCredential,
  });
  if (isSessionServiceError(result)) {
    return jsonServiceError(result);
  }
  return new Response(result, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
