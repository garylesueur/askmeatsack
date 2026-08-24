import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WAIT_BUDGET_SECONDS, WAIT_FUNCTION_MAX_SECONDS, WAIT_MAX_SECONDS } from "./schema";

const root = process.cwd();

/**
 * The bug these guard against: WAIT_MAX_SECONDS and the route's maxDuration
 * were both 60, so a wait for the documented maximum burned the whole budget
 * and was killed before it could answer. Production returned 504 for the one
 * value every instruction told an agent to use. Nothing caught it, because the
 * suite injects a fake sleep and the collision only exists on real time.
 */
function maxDurationOf(routePath: string): number {
  const source = readFileSync(join(root, routePath), "utf8");
  const match = source.match(/^export const maxDuration = (\d+);$/m);
  expect(match, `${routePath} declares no maxDuration`).not.toBeNull();
  return Number(match?.[1]);
}

describe("wait budget", () => {
  it("leaves the handler room to answer inside the function limit", () => {
    expect(WAIT_BUDGET_SECONDS).toBeLessThan(WAIT_FUNCTION_MAX_SECONDS);
    // Enough for a cold start plus serialising the reply. 55s once survived by
    // 4.8s, which is not room, it is luck.
    expect(WAIT_FUNCTION_MAX_SECONDS - WAIT_BUDGET_SECONDS).toBeGreaterThanOrEqual(10);
  });

  it("never sits longer than the bound it advertises", () => {
    expect(WAIT_BUDGET_SECONDS).toBeLessThanOrEqual(WAIT_MAX_SECONDS);
  });

  it("matches the maxDuration of every route that runs a wait", () => {
    for (const route of [
      "src/app/api/v1/sessions/[sessionId]/wait/route.ts",
      "src/app/mcp/route.ts",
    ]) {
      expect(maxDurationOf(route), route).toBe(WAIT_FUNCTION_MAX_SECONDS);
    }
  });

  it("gives the routes that deliver callbacks room for the retries", () => {
    const budgetMs = [0, 1_000, 4_000].reduce((total, backoff) => total + backoff + 8_000, 0);
    for (const route of [
      "src/app/api/v1/sessions/[sessionId]/submit/route.ts",
      "src/app/api/v1/sessions/[sessionId]/cancel/route.ts",
      "src/app/api/v1/sessions/[sessionId]/answers/route.ts",
    ]) {
      expect(maxDurationOf(route) * 1000, route).toBeGreaterThanOrEqual(budgetMs);
    }
  });
});
