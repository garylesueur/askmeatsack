import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  llmsTxt,
  mcpGetDocumentKind,
  mcpGuideHtml,
  mcpGuideMarkdown,
  skillMarkdown,
} from "./agent-docs";
import { ASKMEATSACK_SKILL_MARKDOWN } from "./askmeatsack-skill";

describe("site agent documents", () => {
  it("treats a browser Accept as the HTML MCP page", () => {
    const kind = mcpGetDocumentKind(
      new Request("https://askmeatsack.com/mcp", {
        headers: {
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      }),
    );
    expect(kind).toBe("html");
  });

  it("treats markdown, plain, or a bare fetch as the MCP guide", () => {
    expect(
      mcpGetDocumentKind(
        new Request("https://askmeatsack.com/mcp", {
          headers: { accept: "text/markdown" },
        }),
      ),
    ).toBe("markdown");
    expect(
      mcpGetDocumentKind(new Request("https://askmeatsack.com/mcp")),
    ).toBe("markdown");
  });

  it("leaves MCP protocol GET alone", () => {
    expect(
      mcpGetDocumentKind(
        new Request("https://askmeatsack.com/mcp", {
          headers: { "mcp-protocol-version": "2025-03-26" },
        }),
      ),
    ).toBe("protocol");
    expect(
      mcpGetDocumentKind(
        new Request("https://askmeatsack.com/mcp", {
          headers: { accept: "application/json" },
        }),
      ),
    ).toBe("protocol");
  });

  it("publishes the same skill as the Cursor skill file", () => {
    const onDisk = readFileSync(
      join(process.cwd(), ".cursor/skills/askmeatsack/SKILL.md"),
      "utf8",
    );
    expect(skillMarkdown()).toBe(ASKMEATSACK_SKILL_MARKDOWN);
    expect(onDisk).toBe(ASKMEATSACK_SKILL_MARKDOWN);
  });

  it("llms.txt and the MCP guide point at the skill and the markdown URL", () => {
    const origin = "https://askmeatsack.com";
    const index = llmsTxt(origin);
    const guide = mcpGuideMarkdown(origin);
    expect(index).toContain(`${origin}/skill.md`);
    expect(index).toContain(`${origin}/mcp.md`);
    expect(guide).toContain("askmeatsack.com");
    expect(guide).toContain("POST /api/v1/sessions");
    expect(guide).toContain("machineUrl");
    expect(guide).toContain(skillMarkdown().trim());
  });

  it("HTML MCP page links the markdown guide and escapes the origin", () => {
    const html = mcpGuideHtml("https://askmeatsack.com");
    expect(html).toContain('href="https://askmeatsack.com/mcp.md"');
    expect(html).toContain('href="https://askmeatsack.com/skill.md"');
    expect(escapeHtml('<script>"x"</script>')).toBe(
      "&lt;script&gt;&quot;x&quot;&lt;/script&gt;",
    );
  });
});
