import { describe, expect, it, vi } from "vitest";
import { askAccountClaimRequest } from "./ask-account-claim";
const body = {
  sourceId: "source",
  proof: "private-proof",
  attemptId: "6225b4ba-405e-49bc-8866-51bd8ecdd1e5",
};
const request = (value: unknown = body) =>
  new Request("https://ask.example/api/v1/account/claims", {
    method: "POST",
    body: JSON.stringify(value),
    headers: { authorization: "Bearer session-bound-token" },
  });
describe("Ask authenticated normalized claim request", () => {
  it("injects verified account separately from proof body and returns only the claimed ID", async () => {
    const verify = vi.fn().mockResolvedValue({ outcome: "accepted", account: "verified-account" });
    const claim = vi.fn().mockResolvedValue({ state: "committed", id: body.sourceId });
    const response = await askAccountClaimRequest(request(), { verify, claim });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "claimed", id: body.sourceId });
    expect(claim).toHaveBeenCalledWith("verified-account", body);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
  });
  it("refuses anonymous/invalid/unavailable authority before claim or storage access", async () => {
    const claim = vi.fn();
    await Promise.all(
      [{ outcome: "anonymous" }, { outcome: "refused" }].map(async (authority) => {
        expect(
          (
            await askAccountClaimRequest(request(), {
              claim,
              verify: vi.fn().mockResolvedValue(authority),
            })
          ).status,
        ).toBe(401);
      }),
    );
    expect(
      (
        await askAccountClaimRequest(request(), {
          claim,
          verify: vi.fn().mockRejectedValue(new Error("unavailable")),
        })
      ).status,
    ).toBe(401);
    expect(claim).not.toHaveBeenCalled();
  });
  it("rejects account overrides and malformed/oversized bodies without forwarding private capabilities", async () => {
    const verify = vi.fn().mockResolvedValue({ outcome: "accepted", account: "account" });
    const claim = vi.fn();
    await Promise.all(
      [
        { ...body, accountId: "forged" },
        { ...body, intentId: "forged" },
        { ...body, attemptId: "not-a-uuid" },
        { ...body, sourceId: "../other" },
      ].map(async (value) => {
        expect((await askAccountClaimRequest(request(value), { verify, claim })).status).toBe(400);
      }),
    );
    expect(
      (
        await askAccountClaimRequest(request({ ...body, proof: "x".repeat(5000) }), {
          verify,
          claim,
        })
      ).status,
    ).toBe(413);
    expect(claim).not.toHaveBeenCalled();
  });
  it("returns pending honestly and rejects unsafe or mismatched coordinator outputs", async () => {
    const verify = vi.fn().mockResolvedValue({ outcome: "accepted", account: "account" });
    const claim = vi
      .fn()
      .mockResolvedValueOnce({ state: "pending" })
      .mockResolvedValueOnce({ state: "committed", id: "foreign" })
      .mockResolvedValueOnce({ state: "committed", id: "source", proof: "private-proof" });
    const pending = await askAccountClaimRequest(request(), { verify, claim });
    expect(pending.status).toBe(409);
    expect(await pending.json()).toEqual({ error: { code: "claim_pending" } });
    expect((await askAccountClaimRequest(request(), { verify, claim })).status).toBe(503);
    const unsafe = await askAccountClaimRequest(request(), { verify, claim });
    expect(unsafe.status).toBe(503);
    expect(await unsafe.text()).not.toContain("private-proof");
  });
});
