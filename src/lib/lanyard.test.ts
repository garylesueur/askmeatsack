import { afterEach, describe, expect, it, vi } from "vitest";
import { lanyardSignInHref } from "./lanyard";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Sign in link", () => {
  it("is hidden until LANYARD_URL is a usable URL", () => {
    vi.stubEnv("LANYARD_URL", "");
    expect(lanyardSignInHref()).toBeUndefined();
    vi.stubEnv("LANYARD_URL", "not a url");
    expect(lanyardSignInHref()).toBeUndefined();
  });

  it("points at lanyard's sign-in for this product", () => {
    vi.stubEnv("LANYARD_URL", "https://lanyard.test/");
    expect(lanyardSignInHref()).toBe("https://lanyard.test/sign-in?product=askmeatsack");
  });
});
