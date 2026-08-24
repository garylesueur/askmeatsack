import { describe, expect, it } from "vitest";
import {
  colorModeCookieDomain,
  isStoredColorMode,
  persistColorModeCookie,
} from "./color-mode";

describe("colour mode persistence", () => {
  it("accepts light, dark, and auto", () => {
    expect(isStoredColorMode("auto")).toBe(true);
    expect(isStoredColorMode("light")).toBe(true);
    expect(isStoredColorMode("system")).toBe(false);
  });

  it("keeps askmeatsack.com cookies on that product origin", () => {
    expect(colorModeCookieDomain("askmeatsack.com")).toBe("; Domain=.askmeatsack.com");
    expect(colorModeCookieDomain("s.showmeatsack.com")).toBe("; Domain=.showmeatsack.com");
  });

  it("writes a year-long SameSite cookie", () => {
    const cookie = persistColorModeCookie("auto", "askmeatsack.com", "https:");
    expect(cookie).toContain("meatsack_color_mode=auto");
    expect(cookie).toContain("Domain=.askmeatsack.com");
    expect(cookie).toContain("Secure");
  });
});
