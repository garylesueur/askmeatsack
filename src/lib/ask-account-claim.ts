import { z } from "zod";
import { accountResponse } from "./account-sessions";
import type { AccountAuthority } from "./account-authority";
import { boundedRequestText } from "./bounded-request-text";
import { OwnedSessionError } from "./owned-session-metadata";
const inputSchema = z
  .object({
    sourceId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    proof: z.string().min(1).max(1024),
    attemptId: z
      .string()
      .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  })
  .strict();
const resultSchema = z.discriminatedUnion("state", [
  z
    .object({ state: z.literal("committed"), id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) })
    .strict(),
  z.object({ state: z.literal("pending") }).strict(),
]);
const failure = (status: number, code: string) =>
  accountResponse(Response.json({ error: { code } }, { status }));
export async function askAccountClaimRequest(
  request: Request,
  deps: {
    verify(request: Request): Promise<AccountAuthority>;
    claim(accountId: string, input: z.infer<typeof inputSchema>): Promise<unknown>;
  },
): Promise<Response> {
  let authority: AccountAuthority;
  try {
    authority = await deps.verify(request);
  } catch {
    return failure(401, "unauthorized");
  }
  if (authority.outcome !== "accepted") return failure(401, "unauthorized");
  try {
    const text = await boundedRequestText(request, 4096);
    if (text === null) return failure(413, "invalid_request");
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return failure(400, "invalid_request");
    }
    const parsed = inputSchema.safeParse(value);
    if (!parsed.success) return failure(400, "invalid_request");
    const result = resultSchema.safeParse(await deps.claim(authority.account, parsed.data));
    if (
      !result.success ||
      (result.data.state === "committed" && result.data.id !== parsed.data.sourceId)
    )
      throw new OwnedSessionError("storage_unavailable");
    return result.data.state === "pending"
      ? failure(409, "claim_pending")
      : accountResponse(Response.json({ status: "claimed", id: result.data.id }));
  } catch (error) {
    const safe = new Set([
      "claim_unavailable",
      "claim_files_unsupported",
      "request_capacity",
      "storage_capacity",
      "canonical_too_large",
      "recovery_busy",
      "conflict",
      "storage_unavailable",
    ]);
    return error instanceof OwnedSessionError && safe.has(error.code)
      ? failure(error.status, error.code)
      : failure(503, "storage_unavailable");
  }
}
