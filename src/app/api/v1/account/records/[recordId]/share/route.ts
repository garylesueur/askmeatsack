import { z } from "zod";
import { accountAction } from "@/lib/owned-account-files";
import { boundedRequestText } from "@/lib/bounded-request-text";
import { getDefaultSessionService, jsonError } from "@/lib/app-sessions";
const input = z
  .object({
    attemptId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    answerUrl: z.string().url().max(2048),
    kind: z.enum(["copied", "shared"]),
  })
  .strict();
type Context = { params: Promise<{ recordId: string }> };
export async function POST(request: Request, context: Context): Promise<Response> {
  return accountAction(request, async (account) => {
    const { recordId } = await context.params;
    let body: unknown;
    try {
      const text = await boundedRequestText(request, 4096);
      if (text === null) return jsonError(413, "invalid_request", "Sharing input is too large");
      body = JSON.parse(text);
    } catch {
      return jsonError(400, "invalid_request", "Body must be JSON");
    }
    const parsed = input.safeParse(body);
    if (!parsed.success) return jsonError(400, "invalid_request", "Sharing input is invalid");
    return getDefaultSessionService().recordSharingForOwner({
      account,
      sessionId: recordId,
      ...parsed.data,
    });
  });
}
