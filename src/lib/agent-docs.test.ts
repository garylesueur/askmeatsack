import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  llmsTxt,
  mcpGetDocumentKind,
  mcpGuideHtml,
  mcpGuideMarkdown,
  siteJsonLd,
  skillMarkdown,
} from "./agent-docs";
import { ASKMEATSACK_SKILL_MARKDOWN } from "./askmeatsack-skill";
import { cursorInstallHref, cursorInstallPageHref } from "./cursor-install";

describe("site agent documents", () => {
  it("treats a browser Accept as the HTML MCP page", () => {
    const kind = mcpGetDocumentKind(
      new Request("https://askmeatsack.com/mcp", {
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
    expect(mcpGetDocumentKind(new Request("https://askmeatsack.com/mcp"))).toBe("markdown");
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
    const onDisk = readFileSync(join(process.cwd(), ".cursor/skills/askmeatsack/SKILL.md"), "utf8");
    expect(skillMarkdown()).toBe(ASKMEATSACK_SKILL_MARKDOWN);
    expect(onDisk).toBe(ASKMEATSACK_SKILL_MARKDOWN);
  });

  it("llms.txt and the MCP guide point at the skill and the markdown URL", () => {
    const origin = "https://askmeatsack.com";
    const index = llmsTxt(origin);
    const guide = mcpGuideMarkdown(origin);
    expect(index).toContain(`${origin}/skill.md`);
    expect(index).toContain(`${origin}/mcp.md`);
    expect(index).toContain("https://github.com/garylesueur/askmeatsack");
    expect(guide).toContain("askmeatsack.com");
    expect(guide).toContain("POST /api/v1/sessions");
    expect(guide).toContain("https://github.com/garylesueur/askmeatsack");
    expect(guide).toContain("machineUrl");
    expect(guide).toContain("manageUrl");
    expect(guide).toContain(skillMarkdown().trim());
  });

  it("HTML MCP page links the markdown guide and escapes the origin", () => {
    const html = mcpGuideHtml("https://askmeatsack.com");
    expect(html).toContain('href="https://askmeatsack.com/mcp.md"');
    expect(html).toContain('href="https://askmeatsack.com/skill.md"');
    expect(html).toContain('href="https://github.com/garylesueur/askmeatsack"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card"');
    expect(escapeHtml('<script>"x"</script>')).toBe("&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
  });

  it("names the product in JSON-LD for search and answer engines", () => {
    const origin = "https://askmeatsack.com";
    const jsonLd = siteJsonLd(origin);
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@graph"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          "@type": "WebSite",
          name: "askmeatsack.com",
          url: origin,
          inLanguage: "en-GB",
        }),
        expect.objectContaining({
          "@type": "SoftwareApplication",
          name: "askmeatsack.com",
          url: origin,
          applicationCategory: "DeveloperApplication",
          sameAs: ["https://github.com/garylesueur/askmeatsack"],
        }),
      ]),
    );
  });

  it("builds Cursor install URLs for the hosted MCP server", () => {
    const mcpUrl = "https://askmeatsack.com/mcp";
    expect(cursorInstallHref(mcpUrl)).toContain("cursor://anysphere.cursor-deeplink/mcp/install?");
    expect(cursorInstallHref(mcpUrl)).toContain("name=askmeatsack.com");
    expect(cursorInstallPageHref(mcpUrl)).toContain("https://cursor.com/en/install-mcp?");
    expect(cursorInstallPageHref(mcpUrl)).toContain("name=askmeatsack.com");
  });
});
