import { getDefaultSessionService, jsonError } from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Body must be JSON");
  }

  const result = await getDefaultSessionService().create(body);
  if (isSessionServiceError(result)) {
    return jsonError(result.status, result.code, result.message);
  }

  return Response.json(result, { status: 201 });
}
