import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";

describe("public crawler files", () => {
  it("lists the public documents and keeps questionnaires off the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual([
      "https://ask.imeatsack.com",
      "https://ask.imeatsack.com/install",
      "https://ask.imeatsack.com/mcp",
      "https://ask.imeatsack.com/mcp.md",
      "https://ask.imeatsack.com/skill.md",
      "https://ask.imeatsack.com/llms.txt",
    ]);
    expect(urls.join(" ")).not.toContain("/s/");
    expect(urls.join(" ")).not.toContain("/api/");
  });

  it("allows the public site and disallows API, questionnaires, and agent rewrites", () => {
    const file = robots();
    expect(file.host).toBe("https://ask.imeatsack.com");
    expect(file.sitemap).toBe("https://ask.imeatsack.com/sitemap.xml");
    expect(file.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/s/", "/agent/", "/play/"],
    });
  });
});
