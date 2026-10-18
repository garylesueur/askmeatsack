import { expect, it, vi } from "vitest";
import { claimReviewRequest, createAskClaimReview } from "./claim-review";
const input = {
  sourceId: "source",
  proof: "private",
  attemptId: "6225b4ba-405e-49bc-8866-51bd8ecdd1e5",
};
const now = Date.parse("2026-10-11T12:00:00Z");
const reviewed = {
  status: "reviewed" as const,
  id: "source",
  title: "Original",
  expiresAt: "2026-10-12T12:00:00Z",
  files: 0,
  retention: "permanent" as const,
  alreadyOwned: false,
};
const request = (body: unknown) =>
  new Request("https://product.test/api/v1/account/claims/review", {
    method: "POST",
    body: JSON.stringify(body),
  });
it("requires verified account authority before source reads and refuses account/proof injection", async () => {
  const review = vi.fn().mockResolvedValue(reviewed);

  expect(
    (
      await claimReviewRequest(request(input), {
        verify: async () => ({ outcome: "refused" }),
        review,
      })
    ).status,
  ).toBe(401);
  expect(review).not.toHaveBeenCalled();
  expect(
    (
      await claimReviewRequest(request({ ...input, accountId: "other" }), {
        verify: async () => ({ outcome: "accepted", account: "owner" }),
        review,
      })
    ).status,
  ).toBe(400);
  expect(review).not.toHaveBeenCalled();
  const response = await claimReviewRequest(request(input), {
    verify: async () => ({ outcome: "accepted", account: "owner" }),
    review,
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(review).toHaveBeenCalledWith(input, "owner");
  expect(await response.json()).toEqual(reviewed);
});
it("refuses mismatched/private-field summaries without reflecting source data", async () => {
  const response = await claimReviewRequest(
    new Request("https://product.test/review", { method: "POST", body: JSON.stringify(input) }),
    {
      verify: async () => ({ outcome: "accepted", account: "owner" }),
      review: vi.fn().mockResolvedValue({ ...reviewed, proof: "private" }),
    },
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private");
});

const file = {
  id: "file",
  questionId: "q",
  filename: "notes.txt",
  contentType: "text/plain",
  size: 3,
  url: "https://product.test/file",
  key: "askmeatsack/source/q/abc-notes.txt",
  uploadedAt: "2026-10-01T12:00:00Z",
};
const source = {
  id: "source",
  status: "submitted" as const,
  title: "Original",
  createdAt: "2026-10-01T12:00:00Z",
  expiresAt: reviewed.expiresAt,
  questions: [],
  answers: {},
  uploads: { file },
  agentToken: "private",
  publicToken: "public",
};
it("reviews original attachment clock and expiry without preparing or mutating ownership", async () => {
  const store = { getById: vi.fn().mockResolvedValue(source) };
  expect(await createAskClaimReview(store, () => now)(input, "owner")).toEqual({
    ...reviewed,
    files: 1,
    retention: "original-file-deadlines",
    earliestRetainedUntil: "2026-12-30T12:00:00.000Z",
  });
  expect(store.getById).toHaveBeenCalledTimes(1);
});
it("conceals foreign ownership and refuses unknown original dates", async () => {
  await expect(
    createAskClaimReview(
      { getById: vi.fn().mockResolvedValue({ ...source, ownerAccountId: "other" }) },
      () => now,
    )(input, "owner"),
  ).rejects.toMatchObject({ code: "claim_unavailable" });
  await expect(
    createAskClaimReview(
      {
        getById: vi
          .fn()
          .mockResolvedValue({ ...source, uploads: { file: { ...file, uploadedAt: undefined } } }),
      },
      () => now,
    )(input, "owner"),
  ).rejects.toMatchObject({ code: "claim_receipt_unknown" });
});
