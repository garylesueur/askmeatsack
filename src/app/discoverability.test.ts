import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";

describe("public crawler files", () => {
  it("lists the public documents and keeps questionnaires off the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual([
      "https://askmeatsack.com",
      "https://askmeatsack.com/mcp",
      "https://askmeatsack.com/mcp.md",
      "https://askmeatsack.com/skill.md",
      "https://askmeatsack.com/llms.txt",
    ]);
    expect(urls.join(" ")).not.toContain("/s/");
    expect(urls.join(" ")).not.toContain("/api/");
  });

  it("allows the public site and disallows API, questionnaires, and agent rewrites", () => {
    const file = robots();
    expect(file.host).toBe("https://askmeatsack.com");
    expect(file.sitemap).toBe("https://askmeatsack.com/sitemap.xml");
    expect(file.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/s/", "/agent/", "/play/"],
    });
  });
});
