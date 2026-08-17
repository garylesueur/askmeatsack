import { createMcpHandler } from "mcp-handler";
import {
  htmlDocumentResponse,
  markdownResponse,
  mcpGetDocumentKind,
  mcpGuideHtml,
  mcpGuideMarkdown,
} from "@/lib/agent-docs";
import { getDefaultSessionService } from "@/lib/app-sessions";
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
      "Create a questionnaire, read status, wait a bounded time, or cancel. Same as the askmeatsack.com HTTP API. Optional appearance.theme: ask, paper, grove, or ember. Questions may include markdown detail (links, guides, mermaid) and allow files. Humans see one question at a time, jump back via steps, and review before submit. Optional callbackUrl is POSTed once on submitted, expired, or cancelled. This service does not score answers.",
      askmeatsackToolInputShape,
      async (args) => {
        const tool = createAskmeatsackTool(getDefaultSessionService());
        const result = await tool.invoke(args);
        const text = JSON.stringify(result);
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
