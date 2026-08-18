import { afterEach, describe, expect, it } from "vitest";
import { createMemoryCounterStore } from "./counter-store";
import {
  clearInstalledCreateRateLimiter,
  createCreateRateLimiter,
  installTestCreateRateLimiter,
  limitCreateFromRequest,
} from "./create-rate-limit";

describe("create rate limit", () => {
  afterEach(() => {
    clearInstalledCreateRateLimiter();
  });

  it("B15 — a flood of creates from one caller is refused", async () => {
    const limiter = createCreateRateLimiter({
      store: createMemoryCounterStore(),
      max: 2,
      windowSeconds: 60,
    });
    expect(await limiter.hit("1.1.1.1")).toEqual({ ok: true });
    expect(await limiter.hit("1.1.1.1")).toEqual({ ok: true });
    const refused = await limiter.hit("1.1.1.1");
    expect(refused.ok).toBe(false);
    if (refused.ok) {
      return;
    }
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(await limiter.hit("2.2.2.2")).toEqual({ ok: true });
  });

  it("B15 — HTTP create uses the caller address", async () => {
    installTestCreateRateLimiter(
      createCreateRateLimiter({
        store: createMemoryCounterStore(),
        max: 1,
        windowSeconds: 60,
      }),
    );
    const first = await limitCreateFromRequest(
      new Request("https://askmeatsack.com/api/v1/shares", {
        headers: { "x-forwarded-for": "9.9.9.9" },
      }),
    );
    const second = await limitCreateFromRequest(
      new Request("https://askmeatsack.com/api/v1/shares", {
        headers: { "x-forwarded-for": "9.9.9.9" },
      }),
    );
    expect(first).toEqual({ ok: true });
    expect(second.ok).toBe(false);
  });
});
