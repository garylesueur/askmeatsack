import { boundedRequestText } from "@/lib/bounded-request-text";
import { executeAskCleanup, verifyAskCleanupSignature } from "@/lib/owned-files-cleanup";
import { defaultAskMetadata } from "@/lib/owned-session-metadata";
import { defaultOwnedAnswerObjects } from "@/lib/owned-answer-objects";
import { jsonError } from "@/lib/app-sessions";
export async function POST(request: Request) {
  const metadata = defaultAskMetadata();
  const objects = defaultOwnedAnswerObjects();
  const secret = process.env.ASK_METADATA_SECRET;
  if (!metadata || !objects || !secret)
    return jsonError(503, "storage_unavailable", "Cleanup is not configured");
  const payload = await boundedRequestText(request, 16384);
  if (payload === null) return jsonError(413, "invalid_request", "Body is too large");
  if (!verifyAskCleanupSignature(payload, request.headers.get("ask-cleanup-signature"), secret))
    return jsonError(401, "invalid_signature", "Cleanup was refused");
  let body: unknown;
  try {
    body = JSON.parse(payload);
  } catch {
    return jsonError(400, "invalid_request", "Body must be JSON");
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("id" in body) ||
    typeof body.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(body.id)
  )
    return jsonError(400, "invalid_request", "A cleanup id is required");
  try {
    const result = await executeAskCleanup({ id: body.id }, { metadata, objects });
    return Response.json(result, {
      status: result.ok ? 200 : 409,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return jsonError(503, "storage_unavailable", "Cleanup could not finish");
  }
}
