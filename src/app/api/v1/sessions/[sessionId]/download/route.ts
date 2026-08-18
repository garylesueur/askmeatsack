import { wantsMarkdownDownload } from "@/lib/answers-download";
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
  const publicToken = readPublicToken(request);
  const sessions = getDefaultSessionService();
  if (wantsMarkdownDownload(request)) {
    const result = await sessions.downloadMarkdownForPublic({
      sessionId,
      publicToken,
    });
    if (isSessionServiceError(result)) {
      return jsonServiceError(result);
    }
    return new Response(result, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="answers.md"',
      },
    });
  }
  const result = await sessions.downloadForPublic({
    sessionId,
    publicToken,
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
