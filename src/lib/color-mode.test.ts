import { describe, expect, it } from "vitest";
import { colorModeCookieDomain, isStoredColorMode, persistColorModeCookie } from "./color-mode";

describe("colour mode persistence", () => {
  it("accepts light, dark, and auto", () => {
    expect(isStoredColorMode("auto")).toBe(true);
    expect(isStoredColorMode("light")).toBe(true);
    expect(isStoredColorMode("system")).toBe(false);
  });

  it("shares the preference across the product and content hosts", () => {
    expect(colorModeCookieDomain("ask.imeatsack.com")).toBe("; Domain=.imeatsack.com");
    expect(colorModeCookieDomain("s.imeatsack.com")).toBe("; Domain=.imeatsack.com");
    expect(colorModeCookieDomain("imeatsack.com.example.com")).toBe("");
  });

  it("writes a year-long SameSite cookie", () => {
    const cookie = persistColorModeCookie("auto", "ask.imeatsack.com", "https:");
    expect(cookie).toContain("meatsack_color_mode=auto");
    expect(cookie).toContain("Domain=.imeatsack.com");
    expect(cookie).toContain("Secure");
  });
});
