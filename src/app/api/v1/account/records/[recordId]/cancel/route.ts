import { accountResponse, accountUnauthorized, verifyAccountRequest } from "@/lib/account-sessions";
import { getDefaultSessionService, jsonServiceError } from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";

type RouteContext = { params: Promise<{ recordId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const authority = await verifyAccountRequest(request);
  if (authority.outcome !== "accepted") return accountUnauthorized();
  const { recordId } = await context.params;
  const result = await getDefaultSessionService().cancelForOwner({
    account: authority.account,
    sessionId: recordId,
  });
  return accountResponse(
    isSessionServiceError(result) ? jsonServiceError(result) : Response.json(result),
  );
}
