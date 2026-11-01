import {
  getDefaultSessionService,
  identifyCreator,
  jsonError,
  jsonServiceError,
  refusedLanyardTokenResponse,
} from "@/lib/app-sessions";
import { limitCreateFromRequest } from "@/lib/create-rate-limit";
import { isSessionServiceError } from "@/lib/sessions";

export async function POST(request: Request): Promise<Response> {
  const limited = await limitCreateFromRequest(request);
  if (!limited.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many questionnaires from this address. Try again later.",
    );
  }

  const creator = await identifyCreator(request);
  if (creator.kind === "refused") {
    return refusedLanyardTokenResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Body must be JSON");
  }

  const result = await getDefaultSessionService().create(
    body,
    creator.kind === "account" ? { account: creator.account } : undefined,
  );
  if (isSessionServiceError(result)) {
    return jsonServiceError(result);
  }

  return Response.json(result, { status: 201 });
}
