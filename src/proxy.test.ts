import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

describe("B23 — answer link discovery", () => {
  it("advertises the token-preserving alternate and llms.txt on HTML", () => {
    const response = proxy(
      new NextRequest("https://ask.imeatsack.com/s/session?t=public-token", {
        headers: { Accept: "text/html" },
      }),
    );
    expect(response.headers.get("Link")).toContain(
      '</s/session.md?t=public-token>; rel="alternate"; type="text/markdown"',
    );
    expect(response.headers.get("Link")).toContain('</llms.txt>; rel="describedby"');
    expect(response.headers.get("Vary")).toBe("Accept");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("negotiates Markdown without dropping the public token or confusing a manage link", () => {
    for (const path of ["/s/session", "/s/session/manage"]) {
      const response = proxy(
        new NextRequest(`https://ask.imeatsack.com${path}?t=public-token`, {
          headers: { Accept: "text/markdown, text/html;q=0.5" },
        }),
      );
      expect(response.headers.get("x-middleware-rewrite")).toBe(
        `https://ask.imeatsack.com${path}/md?t=public-token`,
      );
      expect(response.headers.get("Vary")).toBe("Accept");
    }
  });
});
