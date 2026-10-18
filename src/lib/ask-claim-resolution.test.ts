import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { askClaimResolutionRequest } from "./ask-claim-resolution";
const secret = "ask-resolution-synthetic-secret";
const resolution = {
  product: "askmeatsack",
  intentId: "intent",
  accountId: "account",
  sourceId: "source",
  attemptId: "6225b4ba-405e-49bc-8866-51bd8ecdd1e5",
  proofHash: "a".repeat(64),
  outcome: "aborted",
};
function request(
  input: unknown = resolution,
  options: { domain?: string; age?: number; signed?: boolean } = {},
) {
  const body = JSON.stringify(input),
    seconds = Math.floor((Date.now() - (options.age ?? 0)) / 1000);
  return new Request("https://ask.example/api/v1/claims/resolve", {
    method: "POST",
    headers: {
      "claim-resolution-signature":
        options.signed === false
          ? ""
          : `t=${seconds},v1=${createHmac("sha256", secret)
              .update(`${seconds}.${options.domain ?? "claim-resolution"}.${body}`)
              .digest("hex")}`,
    },
    body,
  });
}
describe("Ask scheduler-only source resolution callback", () => {
  it("acknowledges only the exact bound resolution after fresh source/native confirmation", async () => {
    const resolve = vi.fn().mockResolvedValue(true);
    const response = await askClaimResolutionRequest(request(), { secret, resolve });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ...resolution });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(resolve).toHaveBeenCalledWith(resolution);
  });
  it("refuses unsigned/stale/wrong-domain callbacks and extra caller authority before resolving", async () => {
    const resolve = vi.fn();
    await Promise.all(
      [{ signed: false }, { age: 301000 }, { domain: "claim-store" }].map(async (options) => {
        expect(
          (await askClaimResolutionRequest(request(resolution, options), { secret, resolve }))
            .status,
        ).toBe(401);
      }),
    );
    await Promise.all(
      [
        { ...resolution, product: "showmeatsack" },
        { ...resolution, ok: true },
        { ...resolution, proof: "private-token" },
        { ...resolution, outcome: "started" },
      ].map(async (input) => {
        expect((await askClaimResolutionRequest(request(input), { secret, resolve })).status).toBe(
          400,
        );
      }),
    );
    expect(resolve).not.toHaveBeenCalled();
  });
  it("does not acknowledge unknown state, failed storage or oversized proof bodies", async () => {
    const resolve = vi.fn().mockResolvedValue(false);
    const response = await askClaimResolutionRequest(request(), { secret, resolve });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "storage_unavailable" });
    resolve.mockRejectedValueOnce(new Error("synthetic private detail"));
    expect((await askClaimResolutionRequest(request(), { secret, resolve })).status).toBe(503);
    const large = request({ ...resolution, extra: "x".repeat(9000) });
    expect((await askClaimResolutionRequest(large, { secret, resolve })).status).toBe(413);
    expect(resolve).toHaveBeenCalledTimes(2);
  });
});
