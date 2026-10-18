import { accountAction, keptFileActions } from "@/lib/owned-account-files";
type Context = { params: Promise<{ fileId: string }> };
export async function GET(request: Request, context: Context) {
  return accountAction(request, async (account) =>
    keptFileActions().get(account, (await context.params).fileId, true),
  );
}
