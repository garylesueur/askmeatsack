import { accountAction } from "@/lib/owned-account-files";
import { accountResponse, accountUnauthorized, verifyAccountRequest } from "@/lib/account-sessions";
import { getDefaultSessionService, jsonServiceError, jsonError } from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";

type RouteContext = { params: Promise<{ recordId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const authority = await verifyAccountRequest(request);
  if (authority.outcome !== "accepted") return accountUnauthorized();
  const { recordId } = await context.params;
  const result = await getDefaultSessionService().getForOwner({
    account: authority.account,
    sessionId: recordId,
  });
  return accountResponse(
    isSessionServiceError(result) ? jsonServiceError(result) : Response.json(result),
  );
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return accountAction(request, async (account) => {
    const { recordId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_json", "Body must be JSON");
    }
    return getDefaultSessionService().updateForOwner({ account, sessionId: recordId, body });
  });
}
export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return accountAction(request, async (account) => {
    const { recordId } = await context.params;
    return getDefaultSessionService().removeForOwner({ account, sessionId: recordId });
  });
}
