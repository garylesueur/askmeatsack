import { describe, expect, it } from "vitest";
import {
  callbackHostResolvesPublicly,
  callbackUrlIsUsable,
  isBlockedAddress,
} from "./callback-url";

describe("B38 — a callback only reaches the public internet", () => {
  it("accepts an ordinary public https address", () => {
    const result = callbackUrlIsUsable("https://example.com/hooks/answers");
    expect(result.ok).toBe(true);
  });

  it("refuses anything that is not https", () => {
    for (const url of [
      "http://example.com/hook",
      "file:///etc/passwd",
      "gopher://example.com",
      "ftp://example.com",
    ]) {
      expect(callbackUrlIsUsable(url)).toMatchObject({ ok: false });
    }
  });

  it("refuses loopback and localhost", () => {
    for (const url of [
      "https://127.0.0.1/hook",
      "https://localhost/hook",
      "https://api.localhost/hook",
      "https://[::1]/hook",
    ]) {
      expect(callbackUrlIsUsable(url)).toMatchObject({ ok: false });
    }
  });

  it("refuses private ranges given as literals", () => {
    for (const url of [
      "https://10.0.0.5/hook",
      "https://192.168.1.1/hook",
      "https://172.16.0.1/hook",
      "https://172.31.255.255/hook",
    ]) {
      expect(callbackUrlIsUsable(url)).toMatchObject({ ok: false });
    }
  });

  it("refuses the cloud metadata address", () => {
    expect(callbackUrlIsUsable("https://169.254.169.254/latest/meta-data/")).toMatchObject({
      ok: false,
    });
  });

  it("refuses credentials in the URL", () => {
    expect(callbackUrlIsUsable("https://user:pass@example.com/hook")).toMatchObject({
      ok: false,
    });
  });

  it("refuses an IPv4 address smuggled inside IPv6", () => {
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:10.0.0.1")).toBe(true);
  });

  it("still allows a public IPv4 literal", () => {
    expect(isBlockedAddress("203.0.113.7")).toBe(false);
  });
});

describe("The host is resolved before delivery", () => {
  it("refuses a name that resolves into a private range", async () => {
    const ok = await callbackHostResolvesPublicly("sneaky.example.com", async () => [
      { address: "10.1.2.3" },
    ]);
    expect(ok).toBe(false);
  });

  it("refuses when any one of several addresses is private", async () => {
    // One public answer is not enough — the private one is still a way in.
    const ok = await callbackHostResolvesPublicly("mixed.example.com", async () => [
      { address: "203.0.113.7" },
      { address: "127.0.0.1" },
    ]);
    expect(ok).toBe(false);
  });

  it("accepts a name that resolves entirely to public addresses", async () => {
    const ok = await callbackHostResolvesPublicly("good.example.com", async () => [
      { address: "203.0.113.7" },
      { address: "198.51.100.4" },
    ]);
    expect(ok).toBe(true);
  });

  it("refuses when the name does not resolve at all", async () => {
    expect(
      await callbackHostResolvesPublicly("nope.example.com", async () => []),
    ).toBe(false);
    expect(
      await callbackHostResolvesPublicly("boom.example.com", async () => {
        throw new Error("SERVFAIL");
      }),
    ).toBe(false);
  });
});
