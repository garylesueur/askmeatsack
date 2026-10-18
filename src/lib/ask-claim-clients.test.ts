import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createAskClaimIntents } from "./ask-claim-intents";
import { createAskMetadata } from "./owned-session-metadata";
const secret = "claim-client-synthetic-secret",
  now = 1_792_000_000_000;
const identity = {
  accountId: "account",
  sourceId: "source",
  attemptId: "6225b4ba-405e-49bc-8866-51bd8ecdd1e5",
  proofHash: "a".repeat(64),
};
const intent = {
  ...identity,
  intentId: "intent",
  product: "askmeatsack",
  state: "prepared",
  createdAt: now,
  deadlineAt: now + 900000,
  sourceResolved: false,
};
describe("Ask signed claim intent and native receipt clients", () => {
  it("sends only hash-bound exact product preparation and accepts the selected original UUID", async () => {
    const original = "6225b4ba-405e-49bc-8866-51bd8ecdd1e6";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ...intent, attemptId: original }));
    const client = createAskClaimIntents({
      url: "https://lanyard.example",
      secret,
      now: () => now,
      fetch: fetcher,
    });
    expect((await client.prepare(identity))?.attemptId).toBe(original);
    const [url, options] = fetcher.mock.calls[0],
      body = String(options?.body),
      seconds = Math.floor(now / 1000);
    expect(String(url)).toBe("https://lanyard.example/api/v1/claims/store");
    expect(JSON.parse(body)).toEqual({
      product: "askmeatsack",
      operation: "prepare",
      input: identity,
    });
    expect(new Headers(options?.headers).get("claim-store-signature")).toBe(
      `t=${seconds},v1=${createHmac("sha256", secret).update(`${seconds}.claim-store.${body}`).digest("hex")}`,
    );
    expect(options).toMatchObject({ cache: "no-store", redirect: "error" });
  });
  it("rejects foreign or malformed status receipts and treats null as unknown", async () => {
    await Promise.all(
      [
        { ...intent, product: "showmeatsack" },
        { ...intent, accountId: "other" },
        { ...intent, proofHash: "b".repeat(64) },
        { ...intent, attemptId: "not-a-uuid" },
      ].map(async (value) => {
        const client = createAskClaimIntents({
          url: "https://lanyard.example",
          secret,
          fetch: vi.fn().mockResolvedValue(Response.json(value)),
        });
        await expect(client.get({ ...identity, intentId: "intent" })).rejects.toMatchObject({
          code: "storage_unavailable",
        });
      }),
    );
    const client = createAskClaimIntents({
      url: "https://lanyard.example",
      secret,
      fetch: vi.fn().mockResolvedValue(Response.json(null)),
    });
    expect(await client.get({ ...identity, intentId: "intent" })).toBeNull();
  });
  it("validates native import arguments and receipts including authoritative committed-after-deletion null payload", async () => {
    const receipt = {
      state: "committed",
      id: "source",
      sourceId: "source",
      attemptId: identity.attemptId,
      snapshotHash: "b".repeat(64),
      request: null,
    };
    const fetcher = vi.fn().mockResolvedValue(Response.json(receipt));
    const metadata = createAskMetadata({ url: "https://lanyard.example", secret, fetch: fetcher });
    const input = {
      ...identity,
      intentId: "intent",
      snapshotHash: receipt.snapshotHash,
      session: "{}",
    };
    expect(await metadata.call("claimRequest", input)).toEqual(receipt);
    await expect(
      metadata.call("claimRequest", { ...input, ownerAccountId: "forged" }),
    ).rejects.toMatchObject({ code: "storage_unavailable" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce(
      Response.json({
        ...receipt,
        request: {
          session: JSON.stringify({ id: "source", ownerAccountId: "other" }),
          revision: 0,
        },
      }),
    );
    await expect(
      metadata.call("getClaim", {
        accountId: "account",
        sourceId: "source",
        snapshotHash: receipt.snapshotHash,
      }),
    ).rejects.toMatchObject({ code: "storage_unavailable" });
  });
});
