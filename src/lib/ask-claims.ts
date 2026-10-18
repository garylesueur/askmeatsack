import { createHash, timingSafeEqual } from "node:crypto";
import { OwnedSessionError, type AskMetadata } from "./owned-session-metadata";
import type { SessionStore } from "./session-store";
import type { AskClaimIntents } from "./ask-claim-intents";
import type { AskAttachmentClaims } from "./ask-attachment-claims";
import {
  askClaimIdentitySchema,
  askClaimReceiptSchema,
  askClaimResolutionSchema,
  type AskClaimBinding,
  type AskClaimResolution,
} from "./ask-claim-protocol";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function refused(): never {
  throw new OwnedSessionError("claim_unavailable", 404, "This request cannot be claimed.");
}
function proofMatches(expected: string, offered: string) {
  return timingSafeEqual(Buffer.from(hash(expected), "hex"), Buffer.from(hash(offered), "hex"));
}
function frozenSource(snapshot: string, sourceId: string, proof: string) {
  const value: unknown = JSON.parse(snapshot);
  if (!value || typeof value !== "object" || Array.isArray(value)) refused();
  const source = value as Record<string, unknown>;
  if (
    source.id !== sourceId ||
    Object.hasOwn(source, "ownerAccountId") ||
    typeof source.agentToken !== "string" ||
    !proofMatches(source.agentToken, proof)
  )
    refused();
  if (
    (source.uploads !== undefined &&
      (!source.uploads ||
        typeof source.uploads !== "object" ||
        Array.isArray(source.uploads) ||
        Object.keys(source.uploads).length)) ||
    (source.answers &&
      typeof source.answers === "object" &&
      Object.values(source.answers).some(
        (answer) =>
          answer &&
          typeof answer === "object" &&
          Object.hasOwn(answer, "files") &&
          (!Array.isArray(answer.files) || answer.files.length),
      ))
  )
    return true;
  return false;
}

/** Server-only groundwork. Account comes from fresh session authority, never the proof body. */
export function createAskClaims(deps: {
  store: SessionStore;
  metadata: AskMetadata;
  intents: AskClaimIntents;
  attachments?: Pick<AskAttachmentClaims, "begin"> | null;
}) {
  function source() {
    const { beginClaim, resolveClaim, inspectClaim } = deps.store;
    if (!beginClaim || !resolveClaim || !inspectClaim)
      throw new OwnedSessionError("storage_unavailable");
    return {
      beginClaim: beginClaim.bind(deps.store),
      resolveClaim: resolveClaim.bind(deps.store),
      inspectClaim: inspectClaim.bind(deps.store),
    };
  }
  async function resolve(input: AskClaimResolution): Promise<boolean> {
    if (!askClaimResolutionSchema.safeParse(input).success) return false;
    const { product: _product, outcome, ...binding } = input;
    const intent = await deps.intents.get(binding);
    if (!intent || intent.state !== outcome) return false;
    const store = source();
    const state = await store.inspectClaim(input.sourceId, input.accountId, input.attemptId);
    if (
      state === "foreign" ||
      (state === "committed" && outcome !== "committed") ||
      (state === "none" && outcome !== "aborted")
    )
      return false;
    // An aborted 'none' resolution installs a permanent attempt barrier before any future fence.
    return store.resolveClaim(input.sourceId, input.accountId, input.attemptId, outcome);
  }
  async function reconcile(
    binding: AskClaimBinding,
    cancelPrepared = false,
  ): Promise<"committed" | "aborted" | "pending"> {
    let intent = await deps.intents.get(binding);
    if (intent?.state === "prepared" && cancelPrepared) {
      await deps.intents.cancel(binding);
      intent = await deps.intents.get(binding); // A cancellation response alone is not resolution authority.
    }
    if (!intent || !["committed", "aborted"].includes(intent.state)) return "pending";
    const outcome = intent.state as "committed" | "aborted";
    if (!(await resolve({ ...binding, product: "askmeatsack", outcome }))) return "pending";
    return outcome;
  }
  return {
    resolve,
    async claim(
      accountId: string,
      body: {
        sourceId: string;
        attemptId: string;
        proof: string;
      },
    ): Promise<{ state: "committed"; id: string } | { state: "pending" }> {
      // Account authority is supplied separately from the private-proof body.
      const input = { ...body, accountId };
      if (!input.proof || input.proof.length > 1024) refused();
      const identity = {
        accountId: input.accountId,
        sourceId: input.sourceId,
        attemptId: input.attemptId,
        proofHash: hash(input.proof),
      };
      if (!askClaimIdentitySchema.safeParse(identity).success) refused();
      const live = await deps.store.getById(input.sourceId);
      if (
        !live ||
        live.id !== input.sourceId ||
        !proofMatches(live.agentToken, input.proof) ||
        (live.ownerAccountId !== undefined && live.ownerAccountId !== input.accountId)
      )
        refused();
      if (live.ownerAccountId !== undefined) {
        // A verified caller can recover existing native ownership after intent fields are scrubbed.
        // A legacy attributed row is not durable import authority.
        if (
          !Number.isSafeInteger(live.storageRevision) ||
          live.storageRevision === undefined ||
          live.storageRevision < 0
        )
          refused();
        return { state: "committed", id: input.sourceId };
      }
      const store = source();
      const prepared = await deps.intents.prepare(identity); // Persist recovery identity before source fencing.
      if (!prepared) refused();
      const binding: AskClaimBinding = {
        ...identity,
        intentId: prepared.intentId,
        attemptId: prepared.attemptId,
      };
      if (["committed", "aborted"].includes(prepared.state)) {
        const state = await reconcile(binding);
        if (state === "aborted") refused();
        return state === "committed" ? { state, id: input.sourceId } : { state: "pending" };
      }
      const fenced = await store.beginClaim(
        input.sourceId,
        input.accountId,
        binding.attemptId,
        input.proof,
      );
      if (!fenced) {
        const state = await reconcile(binding, true);
        if (state === "aborted") refused();
        return state === "committed" ? { state, id: input.sourceId } : { state: "pending" };
      }
      const snapshotHash = hash(fenced.snapshot);
      try {
        const hasFiles = frozenSource(fenced.snapshot, input.sourceId, input.proof);
        if (hasFiles) {
          if (!deps.attachments)
            throw new OwnedSessionError(
              "claim_files_unsupported",
              409,
              "Claiming requests with attachments is not configured.",
            );
          if (prepared.state !== "started")
            await deps.attachments.begin(binding, snapshotHash, fenced.snapshot);
          const state = await reconcile(binding);
          return state === "committed" ? { state, id: input.sourceId } : { state: "pending" };
        }
        if (prepared.state === "started") {
          const value = await deps.metadata.call<unknown>("getClaim", {
            accountId: input.accountId,
            sourceId: input.sourceId,
            snapshotHash,
          });
          if (value === null) return { state: "pending" };
          const receipt = askClaimReceiptSchema.safeParse(value);
          if (
            !receipt.success ||
            receipt.data.sourceId !== input.sourceId ||
            receipt.data.snapshotHash !== snapshotHash ||
            receipt.data.attemptId !== binding.attemptId
          )
            throw new OwnedSessionError("storage_unavailable");
          const state = await reconcile(binding);
          return state === "committed" ? { state, id: input.sourceId } : { state: "pending" };
        }
        const value = await deps.metadata.call<unknown>("claimRequest", {
          ...binding,
          snapshotHash,
          session: fenced.snapshot,
        });
        const receipt = askClaimReceiptSchema.safeParse(value);
        if (
          !receipt.success ||
          receipt.data.sourceId !== input.sourceId ||
          receipt.data.snapshotHash !== snapshotHash ||
          receipt.data.attemptId !== binding.attemptId
        )
          throw new OwnedSessionError("storage_unavailable");
      } catch (error) {
        // Capacity/errors do not imply abort. Cancel only a still-prepared intent, then read its terminal state.
        const state = await reconcile(binding, true);
        if (state === "committed") return { state, id: input.sourceId };
        if (state === "aborted") throw error;
        return { state: "pending" };
      }
      const state = await reconcile(binding);
      return state === "committed" ? { state, id: input.sourceId } : { state: "pending" };
    },
  };
}
