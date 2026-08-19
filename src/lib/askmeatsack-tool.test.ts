import { describe, expect, it } from "vitest";
import { apiErrorBody } from "./app-sessions";
import { createAskmeatsackTool, ASKMEATSACK_TOOL_NAME } from "./askmeatsack-tool";
import { createMemorySessionStore } from "./session-store";
import { createSessionService, isSessionServiceError } from "./sessions";

const usableQuestions = [
  {
    id: "Q1",
    prompt: "What should we call this?",
    options: [
      { id: "1", label: "askmeatsack.com" },
      { id: "2", label: "Something else" },
    ],
  },
];

function toolWithStore() {
  let now = new Date("2026-08-16T20:00:00.000Z");
  const store = createMemorySessionStore();
  const sessions = createSessionService({
    store,
    now: () => now,
    createId: () => "session-1",
    createToken: (() => {
      let n = 0;
      return () => {
        n += 1;
        return n === 1
          ? "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa"
          : "agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
      };
    })(),
    publicBaseUrl: "https://askmeatsack.com",
    sleep: async (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
    postCallback: async () => {
      return;
    },
  });
  return {
    sessions,
    tool: createAskmeatsackTool(sessions),
  };
}

describe("B20 — The agent tool is named askmeatsack.com", () => {
  it("The tool name is askmeatsack.com", async () => {
    const { tool } = toolWithStore();
    expect(tool.name).toBe(ASKMEATSACK_TOOL_NAME);
    expect(tool.name).toBe("askmeatsack.com");
  });
});

describe("B1 — Tool create matches HTTP", () => {
  it("F2.T1 — Create returns the same answer link and status link as HTTP", async () => {
    const { tool } = toolWithStore();
    const viaTool = await tool.invoke({
      action: "create",
      title: "Naming",
      questions: usableQuestions,
    });
    expect(viaTool).toMatchObject({
      sessionId: "session-1",
      status: "pending",
      expiresAt: "2026-08-17T20:00:00.000Z",
      answerUrl: "https://askmeatsack.com/s/session-1?t=public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      pollUrl:
        "https://askmeatsack.com/api/v1/sessions/session-1?token=agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      manageUrl:
        "https://askmeatsack.com/s/session-1/manage?token=agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
  });

  it("F2.T2 — Unusable questions are refused and do not return an answer link", async () => {
    const { tool } = toolWithStore();
    const result = await tool.invoke({
      action: "create",
      questions: [],
    });
    expect(result).toMatchObject({
      code: "invalid_questions",
      status: 400,
      message: "Need at least one question",
      issues: [{ code: "questions_required" }],
    });
    expect(result).not.toHaveProperty("answerUrl");
  });

  it("Tool errors use the same nested envelope as HTTP", async () => {
    const { tool } = toolWithStore();
    const result = await tool.invoke({
      action: "create",
      questions: [
        {
          id: "villain",
          prompt: "Anything else?",
          allowComment: true,
        },
      ],
    });
    expect(result).toMatchObject({
      code: "invalid_questions",
      status: 400,
      issues: [{ questionId: "villain", code: "comment_needs_shape" }],
    });
    expect(isSessionServiceError(result)).toBe(true);
    if (!isSessionServiceError(result)) {
      return;
    }
    expect(apiErrorBody(result)).toEqual({
      error: {
        code: "invalid_questions",
        message:
          "Question villain: allowComment is only valid on a choice, items, or fields question",
        issues: [
          {
            questionId: "villain",
            code: "comment_needs_shape",
            message: "allowComment is only valid on a choice, items, or fields question",
          },
        ],
      },
    });
  });
});

describe("B4 — Tool status shows progress before submit", () => {
  it("Status after a save is in_progress with the same answers as HTTP", async () => {
    const { tool, sessions } = toolWithStore();
    await tool.invoke({ action: "create", questions: usableQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken: "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      body: { selectedOptionIds: ["1"] },
    });
    const viaTool = await tool.invoke({
      action: "status",
      sessionId: "session-1",
      agentToken: "agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    const viaHttp = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken: "agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      hasCreateCredential: false,
    });
    expect(viaTool).toMatchObject({
      status: "in_progress",
      answers: { Q1: { selectedOptionIds: ["1"] } },
    });
    expect(viaHttp).toMatchObject(viaTool as object);
  });

  it("Status without the agent token does not leak the questionnaire", async () => {
    const { tool } = toolWithStore();
    await tool.invoke({ action: "create", questions: usableQuestions });
    const result = await tool.invoke({
      action: "status",
      sessionId: "session-1",
    });
    expect(result).toMatchObject({ code: "not_found", status: 404 });
  });
});

describe("B7 — Tool status matches HTTP", () => {
  it("Status after submit returns the same finished answers as HTTP", async () => {
    const { tool, sessions } = toolWithStore();
    await tool.invoke({ action: "create", questions: usableQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken: "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      body: { selectedOptionIds: ["1"] },
    });
    await sessions.submit({
      sessionId: "session-1",
      publicToken: "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    const viaTool = await tool.invoke({
      action: "status",
      sessionId: "session-1",
      agentToken: "agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    const viaHttp = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken: "agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      hasCreateCredential: false,
    });
    expect(viaTool).toMatchObject({
      status: "submitted",
      answers: { Q1: { selectedOptionIds: ["1"] } },
    });
    expect(viaHttp).toMatchObject(viaTool as object);
  });
});

describe("B13 — Tool wait matches HTTP", () => {
  it("Wait on an open session returns current progress when the bound ends", async () => {
    const { tool } = toolWithStore();
    await tool.invoke({ action: "create", questions: usableQuestions });
    const result = await tool.invoke({
      action: "wait",
      sessionId: "session-1",
      agentToken: "agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      seconds: 2,
    });
    expect(result).toMatchObject({ status: "pending", answers: {} });
  });
});

describe("B17 — Tool cancel matches HTTP", () => {
  it("Cancel while open becomes cancelled", async () => {
    const { tool } = toolWithStore();
    await tool.invoke({ action: "create", questions: usableQuestions });
    const result = await tool.invoke({
      action: "cancel",
      sessionId: "session-1",
      agentToken: "agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(result).toMatchObject({ status: "cancelled" });
  });
});

describe("B28 — Tool edit matches HTTP", () => {
  it("F3.T3 — Edit while pending updates the title", async () => {
    const { tool } = toolWithStore();
    await tool.invoke({ action: "create", questions: usableQuestions });
    const result = await tool.invoke({
      action: "edit",
      sessionId: "session-1",
      agentToken: "agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      title: "Renamed",
    });
    expect(result).toMatchObject({ title: "Renamed", status: "pending" });
  });
});
