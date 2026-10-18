import { getDefaultStore } from "@/lib/app-sessions";
import { defaultAskMetadata } from "@/lib/owned-session-metadata";
import { createAskClaimIntents } from "@/lib/ask-claim-intents";
import { createAskClaims } from "@/lib/ask-claims";
import { askClaimResolutionRequest } from "@/lib/ask-claim-resolution";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  return askClaimResolutionRequest(request, {
    secret: process.env.ASK_METADATA_SECRET ?? "",
    async resolve(input) {
      const metadata = defaultAskMetadata();
      if (!metadata) return false;
      const intents = createAskClaimIntents({
        url: process.env.LANYARD_URL ?? "https://meatsack.puregaz.com",
        secret: process.env.ASK_METADATA_SECRET ?? "",
      });
      return createAskClaims({ store: getDefaultStore(), metadata, intents }).resolve(input);
    },
  });
}
