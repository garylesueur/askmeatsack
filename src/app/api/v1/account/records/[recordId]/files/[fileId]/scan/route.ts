import { accountAction } from "@/lib/owned-account-files";
import { getDefaultSessionService } from "@/lib/app-sessions";
type Context = { params: Promise<{ recordId: string; fileId: string }> };
export async function POST(request: Request, context: Context) {
  return accountAction(request, async (account) => {
    const { recordId, fileId } = await context.params;
    return getDefaultSessionService().retryFileScanForOwner({
      account,
      sessionId: recordId,
      fileId,
    });
  });
}
