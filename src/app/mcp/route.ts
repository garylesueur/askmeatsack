import { createMcpHandler } from "mcp-handler";
import {
  htmlDocumentResponse,
  markdownResponse,
  mcpGetDocumentKind,
  mcpGuideHtml,
  mcpGuideMarkdown,
} from "@/lib/agent-docs";
import { getDefaultSessionService, apiErrorBody } from "@/lib/app-sessions";
import { ASKMEATSACK_SKILL_MARKDOWN } from "@/lib/askmeatsack-skill";
import {
  ASKMEATSACK_TOOL_NAME,
  askmeatsackToolInputShape,
  createAskmeatsackTool,
  isAskmeatsackToolError,
} from "@/lib/askmeatsack-tool";

export const maxDuration = 60;

const mcpHandler = createMcpHandler(
  (server) => {
    server.tool(
      ASKMEATSACK_TOOL_NAME,
      'Use this instead of listing questions in the chat whenever you need more than one thing from a person, need a file, photo, or ID, or want structured answers. Also the right tool when they say "ask me some questions", "interview me", "quiz me", "what do you need from me", or any dictated form of meatsack ("meat sack", "mute sack", "meats act", "meat sac"). Create a questionnaire, inspect or edit it on the private manage link while still pending, read status, wait a bounded time, or cancel. Same as the askmeatsack.com HTTP API. Create returns answerUrl, manageUrl, and pollUrl. Optional appearance.theme: ask, paper, grove, or ember — each follows the person’s system light or dark unless mode is set. Prompt is the short ask; markdown detail (tables, guides, mermaid) sits in a rail beside it. Questions may be a choice, free text, items (two to sixteen rows), or fields (two to eight named boxes), and may allow files. allowComment is only valid on a choice, items, or fields question — not on free text or photo-only. Humans see one question at a time, jump back via steps, and review before submit. Optional callbackUrl is POSTed once on submitted, expired, or cancelled. This service does not score answers.',
      askmeatsackToolInputShape,
      async (args) => {
        const tool = createAskmeatsackTool(getDefaultSessionService());
        const result = await tool.invoke(args);
        const text = JSON.stringify(
          isAskmeatsackToolError(result) ? apiErrorBody(result) : result,
        );
        if (isAskmeatsackToolError(result)) {
          return {
            content: [{ type: "text" as const, text }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text }],
        };
      },
    );
  },
  {
    serverInfo: {
      name: "askmeatsack.com",
      version: "0.1.0",
    },
    // Clients that install the bare MCP URL never see skills/askmeatsack/SKILL.md.
    // The initialize result is the only channel that reaches them, so ship it here.
    instructions: ASKMEATSACK_SKILL_MARKDOWN,
  },
  {
    disableSse: true,
    maxDuration: 60,
    verboseLogs: false,
  },
);

function withMcpCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version, Last-Event-ID",
  );
  headers.set(
    "Access-Control-Expose-Headers",
    "mcp-session-id, mcp-protocol-version",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function POST(request: Request): Promise<Response> {
  return withMcpCors(await mcpHandler(request));
}

export async function GET(request: Request): Promise<Response> {
  const kind = mcpGetDocumentKind(request);
  if (kind === "markdown") {
    return markdownResponse(mcpGuideMarkdown());
  }
  if (kind === "html") {
    return htmlDocumentResponse(mcpGuideHtml());
  }
  return withMcpCors(await mcpHandler(request));
}

export async function DELETE(request: Request): Promise<Response> {
  return withMcpCors(await mcpHandler(request));
}

export async function OPTIONS(): Promise<Response> {
  return withMcpCors(new Response(null, { status: 204 }));
}
