import { markdownResponse, skillMarkdown } from "@/lib/agent-docs";

export async function GET(): Promise<Response> {
  return markdownResponse(skillMarkdown());
}
