import { afterEach, describe, expect, it } from "vitest";
import { apiErrorBody, jsonError, readCreateCredential } from "./app-sessions";

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

describe("API error envelope", () => {
  it("HTTP and the tool wrap code, message, and issues the same way", async () => {
    const error = {
      code: "invalid_questions",
      message:
        "Question villain: allowComment is only valid on a choice, items, or fields question",
      status: 400,
      issues: [
        {
          questionId: "villain",
          code: "comment_needs_shape",
          message: "allowComment is only valid on a choice, items, or fields question",
        },
      ],
    };
    const body = apiErrorBody(error);
    expect(body).toEqual({
      error: {
        code: error.code,
        message: error.message,
        issues: error.issues,
      },
    });
    const response = jsonError(error.status, error.code, error.message, error.issues);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(body);
  });
});
