import { getDefaultSessionService, jsonError } from "@/lib/app-sessions";
import { accountAction } from "@/lib/owned-account-files";
import { isSessionServiceError } from "@/lib/sessions";
type Context = { params: Promise<{ recordId: string }> };
export async function GET(request: Request, context: Context) {
  return accountAction(request, async (account) => {
    const { recordId } = await context.params;
    const format = new URL(request.url).searchParams.get("format") ?? "json";
    if (format !== "json" && format !== "markdown")
      return jsonError(400, "invalid_format", "Use json or markdown");
    const result = await getDefaultSessionService().downloadForOwner({
      account,
      sessionId: recordId,
      format,
    });
    return typeof result === "string"
      ? new Response(result, { headers: { "Content-Type": "text/markdown; charset=utf-8" } })
      : isSessionServiceError(result)
        ? result
        : Response.json(result);
  });
}
