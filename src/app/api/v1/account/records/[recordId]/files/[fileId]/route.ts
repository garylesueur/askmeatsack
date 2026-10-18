import { getDefaultSessionService } from "@/lib/app-sessions";
import { accountAction, proxyOwnerFile } from "@/lib/owned-account-files";
import { isSessionServiceError } from "@/lib/sessions";
type Context = { params: Promise<{ recordId: string; fileId: string }> };
export async function GET(request: Request, context: Context) {
  return accountAction(request, async (account) => {
    const { recordId, fileId } = await context.params;
    const file = await getDefaultSessionService().readFileForOwner({
      account,
      sessionId: recordId,
      fileId,
    });
    return isSessionServiceError(file) ? file : proxyOwnerFile(file);
  });
}
