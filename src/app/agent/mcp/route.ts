import { markdownResponse, mcpGuideMarkdown } from "@/lib/agent-docs";

export async function GET(): Promise<Response> {
  return markdownResponse(mcpGuideMarkdown());
}
