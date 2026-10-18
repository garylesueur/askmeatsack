import { claimReviewRequest, createAskClaimReview } from "@/lib/claim-review";
import { verifyAccountRequest } from "@/lib/account-sessions";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return claimReviewRequest(request, {
    verify: verifyAccountRequest,
    review: createAskClaimReview(),
  });
}
