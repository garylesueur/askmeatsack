import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { boundedRequestText } from "./bounded-request-text";
const schema = z.object({ intentId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) }).strict();
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "ask-claim-process-signature" },
  });
export async function askAttachmentProcessRequest(
  request: Request,
  deps: { secret: string; process(intentId: string): Promise<boolean>; now?: () => number },
): Promise<Response> {
  try {
    const body = await boundedRequestText(request, 1024);
    if (body === null) return reply({ error: "invalid_request" }, 413);
    const signature = /^t=(\d{1,12}),v1=([a-f0-9]{64})$/.exec(
      request.headers.get("ask-claim-process-signature") ?? "",
    );
    if (
      !deps.secret ||
      !signature ||
      Math.abs((deps.now?.() ?? Date.now()) - Number(signature[1]) * 1000) > 300_000 ||
      !timingSafeEqual(
        createHmac("sha256", deps.secret)
          .update(`${signature[1]}.ask-claim-process.${body}`)
          .digest(),
        Buffer.from(signature[2], "hex"),
      )
    )
      return reply({ error: "unauthorised" }, 401);
    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      return reply({ error: "invalid_request" }, 400);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return reply({ error: "invalid_request" }, 400);
    if (!(await deps.process(parsed.data.intentId)))
      return reply({ error: "storage_unavailable" }, 503);
    return reply({ ok: true, intentId: parsed.data.intentId });
  } catch {
    return reply({ error: "storage_unavailable" }, 503);
  }
}
