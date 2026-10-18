import { defaultAskAttachmentClaims } from "@/lib/ask-attachment-claims";
import { askAttachmentProcessRequest } from "@/lib/ask-attachment-request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  return askAttachmentProcessRequest(request, {
    secret: process.env.ASK_METADATA_SECRET ?? "",
    process: async (intentId) => {
      const claims = defaultAskAttachmentClaims();
      return claims ? claims.process(intentId) : false;
    },
  });
}
