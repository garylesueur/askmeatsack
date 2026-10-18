import { askAccountClaimRequest } from "@/lib/ask-account-claim";
import { verifyAccountRequest } from "@/lib/account-sessions";
import { getDefaultStore } from "@/lib/app-sessions";
import { defaultAskMetadata, OwnedSessionError } from "@/lib/owned-session-metadata";
import { createAskClaimIntents } from "@/lib/ask-claim-intents";
import { createAskClaims } from "@/lib/ask-claims";
import { defaultAskAttachmentClaims } from "@/lib/ask-attachment-claims";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  return askAccountClaimRequest(request, {
    verify: verifyAccountRequest,
    async claim(accountId, body) {
      const metadata = defaultAskMetadata();
      if (!metadata) throw new OwnedSessionError("storage_unavailable");
      const intents = createAskClaimIntents({
        url: process.env.LANYARD_URL ?? "https://meatsack.puregaz.com",
        secret: process.env.ASK_METADATA_SECRET ?? "",
      });
      return createAskClaims({
        store: getDefaultStore(),
        metadata,
        intents,
        attachments: defaultAskAttachmentClaims(),
      }).claim(accountId, body);
    },
  });
}
