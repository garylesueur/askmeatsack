import { defaultAskAttachmentClaims } from "@/lib/ask-attachment-claims";
import { boundedRequestText } from "@/lib/bounded-request-text";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await boundedRequestText(request, 8192);
    if (body === null) return Response.json({ error: "invalid_request" }, { status: 413 });
    const claims = defaultAskAttachmentClaims();
    if (!claims || !(await claims.callback(body, request.headers.get("cleanroom-signature"))))
      return Response.json(
        { error: "storage_unavailable" },
        { status: 503, headers: { "Cache-Control": "private, no-store" } },
      );
    return Response.json({ received: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json(
      { error: "storage_unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
