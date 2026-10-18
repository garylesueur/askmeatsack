import { accountAction, keptFileActions } from "@/lib/owned-account-files";
export async function GET(request: Request) {
  return accountAction(request, (account) =>
    keptFileActions().list(account, new URL(request.url).searchParams),
  );
}
