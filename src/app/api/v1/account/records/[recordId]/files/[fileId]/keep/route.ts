import { accountAction, keptFileActions } from "@/lib/owned-account-files";
type Context = { params: Promise<{ recordId: string; fileId: string }> };
export async function POST(request: Request, context: Context) {
  return accountAction(request, async (account) => {
    const { recordId, fileId } = await context.params;
    return keptFileActions().keep(account, recordId, fileId, request);
  });
}
