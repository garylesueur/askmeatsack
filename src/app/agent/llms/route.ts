import { llmsTxt, plainTextResponse } from "@/lib/agent-docs";

export async function GET(): Promise<Response> {
  return plainTextResponse(llmsTxt(), "text/plain; charset=utf-8");
}
