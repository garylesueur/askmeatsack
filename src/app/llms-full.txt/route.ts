import { llmsFullTxt, discoveryTextResponse } from "@/lib/agent-docs";

export function GET(): Response {
  return discoveryTextResponse(llmsFullTxt(), "text/plain");
}
