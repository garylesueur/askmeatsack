import { createHmac } from "node:crypto";
import { OwnedSessionError } from "./owned-session-metadata";
import {
  askClaimIdentitySchema,
  askClaimBindingSchema,
  askClaimIntentSchema,
  type AskClaimIdentity,
  type AskClaimBinding,
  type AskClaimIntent,
} from "./ask-claim-protocol";
export type AskClaimIntents = {
  prepare(input: AskClaimIdentity): Promise<AskClaimIntent | null>;
  get(input: AskClaimBinding): Promise<AskClaimIntent | null>;
  cancel(input: AskClaimBinding): Promise<AskClaimIntent | null>;
};
export function createAskClaimIntents(deps: {
  url: string;
  secret: string;
  fetch?: typeof fetch;
  now?: () => number;
}): AskClaimIntents {
  const target = new URL("/api/v1/claims/store", deps.url);
  async function call(
    operation: "prepare" | "get" | "cancel",
    input: AskClaimIdentity | AskClaimBinding,
  ) {
    if (
      !deps.secret ||
      !(operation === "prepare" ? askClaimIdentitySchema : askClaimBindingSchema).safeParse(input)
        .success
    )
      throw new OwnedSessionError("storage_unavailable");
    const body = JSON.stringify({ product: "askmeatsack", operation, input });
    const seconds = Math.floor((deps.now?.() ?? Date.now()) / 1000);
    try {
      const response = await (deps.fetch ?? fetch)(target, {
        method: "POST",
        body,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
        headers: {
          "Content-Type": "application/json",
          "claim-store-signature": `t=${seconds},v1=${createHmac("sha256", deps.secret).update(`${seconds}.claim-store.${body}`).digest("hex")}`,
        },
      });
      if (!response.ok) throw new OwnedSessionError("storage_unavailable");
      const result: unknown = await response.json();
      if (result === null) return null;
      const parsed = askClaimIntentSchema.safeParse(result);
      if (
        !parsed.success ||
        parsed.data.accountId !== input.accountId ||
        parsed.data.sourceId !== input.sourceId ||
        parsed.data.proofHash !== input.proofHash ||
        (operation !== "prepare" &&
          (parsed.data.attemptId !== input.attemptId ||
            parsed.data.intentId !== (input as AskClaimBinding).intentId))
      )
        throw new OwnedSessionError("storage_unavailable");
      return parsed.data;
    } catch {
      throw new OwnedSessionError("storage_unavailable");
    }
  }
  return {
    prepare: (input) => call("prepare", input),
    get: (input) => call("get", input),
    cancel: (input) => call("cancel", input),
  };
}
