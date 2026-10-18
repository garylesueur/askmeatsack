import { createHmac, timingSafeEqual } from "node:crypto";
import { boundedRequestText } from "./bounded-request-text";
import { askClaimResolutionSchema, type AskClaimResolution } from "./ask-claim-protocol";
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "claim-resolution-signature" },
  });
export function verifyAskClaimResolutionSignature(
  body: string,
  header: string | null,
  secret: string,
  now = Date.now(),
) {
  const match = /^t=(\d{1,12}),v1=([a-f0-9]{64})$/.exec(header ?? "");
  if (!secret || !match || Math.abs(now - Number(match[1]) * 1000) > 300_000) return false;
  const expected = createHmac("sha256", secret)
    .update(`${match[1]}.claim-resolution.${body}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(match[2], "hex"));
}
/** Scheduler-only acknowledgement. The resolver rereads terminal native intent authority before touching the source. */
export async function askClaimResolutionRequest(
  request: Request,
  deps: {
    secret: string;
    resolve(input: AskClaimResolution): Promise<boolean>;
    now?: () => number;
  },
): Promise<Response> {
  try {
    const body = await boundedRequestText(request, 8192);
    if (body === null) return reply({ error: "invalid_request" }, 413);
    if (
      !verifyAskClaimResolutionSignature(
        body,
        request.headers.get("claim-resolution-signature"),
        deps.secret,
        deps.now?.(),
      )
    )
      return reply({ error: "unauthorised" }, 401);
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch {
      return reply({ error: "invalid_request" }, 400);
    }
    const parsed = askClaimResolutionSchema.safeParse(value);
    if (!parsed.success) return reply({ error: "invalid_request" }, 400);
    if (!(await deps.resolve(parsed.data))) return reply({ error: "storage_unavailable" }, 503);
    return reply({ ok: true, ...parsed.data });
  } catch {
    return reply({ error: "storage_unavailable" }, 503);
  }
}
