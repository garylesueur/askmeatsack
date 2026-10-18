import { accountResponse, accountUnauthorized, verifyAccountRequest } from "@/lib/account-sessions";
import {
  getDefaultSessionService,
  getDefaultStore,
  jsonError,
  jsonServiceError,
} from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";
import { ownerPageOffset } from "@/lib/session-store";

export async function GET(request: Request): Promise<Response> {
  const authority = await verifyAccountRequest(request);
  if (authority.outcome !== "accepted") return accountUnauthorized();
  const query = new URL(request.url).searchParams;
  const cursor = query.get("cursor") ?? undefined;
  const requestedLimit = query.get("limit");
  if (requestedLimit !== null && !/^[1-9]\d{0,2}$/.test(requestedLimit)) {
    return accountResponse(jsonError(400, "invalid_page", "Limit must be a positive integer"));
  }
  try {
    if (cursor && cursor.length > 4096) throw new Error("Invalid cursor");
    if (
      cursor &&
      (!getDefaultStore().listOwnedSummaries ||
        /^[0-9]/.test(cursor) ||
        cursor.startsWith("legacy:"))
    )
      ownerPageOffset(cursor.replace(/^legacy:/, ""));
  } catch {
    return accountResponse(jsonError(400, "invalid_page", "Cursor is invalid"));
  }
  if (
    (query.get("search")?.length ?? 0) > 200 ||
    (query.get("status") &&
      !["pending", "opened", "in_progress", "submitted", "cancelled", "expired"].includes(
        query.get("status")!,
      ))
  )
    return accountResponse(jsonError(400, "invalid_filter", "Filter is invalid"));
  const result = await getDefaultSessionService().listForOwner({
    account: authority.account,
    search: query.get("search")?.slice(0, 200) || undefined,
    status: query.get("status") || undefined,
    cursor,
    limit: requestedLimit === null ? undefined : Math.min(100, Number(requestedLimit)),
  });
  return accountResponse(
    isSessionServiceError(result) ? jsonServiceError(result) : Response.json(result),
  );
}
