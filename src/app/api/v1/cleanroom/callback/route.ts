import { boundedRequestText } from "@/lib/bounded-request-text";
import { defaultOwnedAnswerFiles } from "@/lib/owned-answer-files";
import { jsonError } from "@/lib/app-sessions";
export async function POST(request: Request) {
  const files = defaultOwnedAnswerFiles();
  if (!files) return jsonError(503, "files_unavailable", "Scanning is not configured");
  const text = await boundedRequestText(request, 65536);
  if (text === null) return jsonError(413, "invalid_request", "Callback is too large");
  try {
    return (await files.callback(text, request.headers.get("cleanroom-signature")))
      ? Response.json({ received: true })
      : jsonError(401, "invalid_signature", "Callback was refused");
  } catch {
    return jsonError(503, "storage_unavailable", "Scan result could not be recorded");
  }
}
