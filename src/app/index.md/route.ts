import { homepageMarkdown, discoveryTextResponse } from "@/lib/agent-docs";

export function GET(): Response {
  return discoveryTextResponse(homepageMarkdown(), "text/markdown");
}
