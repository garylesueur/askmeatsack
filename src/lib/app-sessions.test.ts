import { afterEach, describe, expect, it } from "vitest";
import { readCreateCredential } from "./app-sessions";

describe("B10 — Optional create credential", () => {
  const original = process.env.AGENT_API_KEY;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.AGENT_API_KEY;
      return;
    }
    process.env.AGENT_API_KEY = original;
  });

  it("Create is open when no shared key is configured", () => {
    delete process.env.AGENT_API_KEY;
    const result = readCreateCredential(new Request("http://localhost/api/v1/sessions"));
    expect(result.missing).toBe(false);
    expect(result.hasCreateCredential).toBe(false);
  });

  it("A matching bearer is still recognised when a shared key exists", () => {
    process.env.AGENT_API_KEY = "test-agent-key-0000000000000000000000";
    const result = readCreateCredential(
      new Request("http://localhost/api/v1/sessions", {
        headers: { Authorization: "Bearer test-agent-key-0000000000000000000000" },
      }),
    );
    expect(result.hasCreateCredential).toBe(true);
  });
});
