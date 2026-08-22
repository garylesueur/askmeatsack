import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ASKMEATSACK_SKILL_MARKDOWN } from "./askmeatsack-skill";

const root = process.cwd();

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(root, name), "utf8"));
}

describe("Agent Plugin package", () => {
  it("declares the portable manifest", () => {
    const manifest = readJson("plugin.json") as {
      $schema: string;
      name: string;
      homepage: string;
      author: { name: string; url: string };
    };
    expect(manifest.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    expect(manifest.name).toBe("askmeatsack.com");
    expect(manifest.homepage).toBe("https://askmeatsack.com");
    expect(manifest.author).toEqual({
      name: "Gary Le Sueur",
      url: "https://gaz.dev",
    });
  });

  it("declares a Cursor plugin so the clone can be added from a local folder", () => {
    const cursor = readJson(".cursor-plugin/plugin.json") as {
      name: string;
      skills: string;
      mcpServers: string;
    };
    const portable = readJson("plugin.json") as { name: string };
    expect(cursor.name).toBe(portable.name);
    expect(cursor.skills).toBe("./skills/");
    expect(cursor.mcpServers).toBe("./mcp.json");
  });

  it("points Agent Plugins MCP at the hosted Streamable HTTP server", () => {
    const mcp = readJson("mcp.json") as {
      $schema: string;
      mcpServers: {
        "askmeatsack.com": { type: string; url: string };
      };
    };
    expect(mcp.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/mcp.schema.json");
    expect(mcp.mcpServers["askmeatsack.com"]).toEqual({
      type: "streamable-http",
      url: "https://askmeatsack.com/mcp",
    });
  });

  it("keeps cursor.directory .mcp.json on the same URL", () => {
    const directory = readJson(".mcp.json") as {
      mcpServers: { "askmeatsack.com": { url: string } };
    };
    const mcp = readJson("mcp.json") as {
      mcpServers: { "askmeatsack.com": { url: string } };
    };
    expect(directory.mcpServers["askmeatsack.com"].url).toBe(mcp.mcpServers["askmeatsack.com"].url);
  });

  it("ships the plugin skill with the same instructions as /skill.md", () => {
    const onDisk = readFileSync(join(root, "skills/askmeatsack/SKILL.md"), "utf8");
    expect(onDisk.startsWith("---\n")).toBe(true);
    expect(onDisk).toContain("name: askmeatsack\n");
    const body = onDisk.replace(/^---\n[\s\S]*?\n---\n\n/, "");
    expect(body).toBe(ASKMEATSACK_SKILL_MARKDOWN);
  });
});
