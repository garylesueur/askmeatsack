import { describe, expect, it } from "vitest";
import { createMemorySessionStore } from "./session-store";
import { createSessionService, humanScreenFor } from "./sessions";

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

function serviceWithStore(options?: {
  onSleep?: () => void | Promise<void>;
  postCallback?: (url: string, body: unknown) => Promise<void>;
}) {
  let now = new Date("2026-08-16T20:00:00.000Z");
  const store = createMemorySessionStore();
  const callbackCalls: Array<{ url: string; body: unknown }> = [];
  const sessions = createSessionService({
    store,
    now: () => now,
    createId: () => "session-1",
    createToken: (() => {
      let n = 0;
      return () => {
        n += 1;
        return n === 1 ? "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa" : "agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
      };
    })(),
    publicBaseUrl: "https://askmeatsack.com",
    sleep: async (ms: number) => {
      await options?.onSleep?.();
      now = new Date(now.getTime() + ms);
    },
    postCallback: async (url, body) => {
      if (options?.postCallback) {
        await options.postCallback(url, body);
        return;
      }
      callbackCalls.push({ url, body });
    },
  });
  return {
    store,
    sessions,
    callbackCalls,
    setNow(next: Date) {
      now = next;
    },
  };
}

describe("B1 — Agent starts a questionnaire", () => {
  it("F2.T1 — Create with usable questions returns an answer link and a status link", async () => {
    const { sessions } = serviceWithStore();
    const result = await sessions.create({
      title: "Naming",
      questions: usableQuestions,
    });

    expect(result).toMatchObject({
      sessionId: "session-1",
      status: "pending",
      expiresAt: "2026-08-17T20:00:00.000Z",
      answerUrl:
        "https://askmeatsack.com/s/session-1?t=public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      pollUrl:
        "https://askmeatsack.com/api/v1/sessions/session-1?token=agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      manageUrl:
        "https://askmeatsack.com/s/session-1/manage?token=agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
  });

  it("F2.T2 — Create with unusable questions is refused and does not return an answer link", async () => {
    const { sessions } = serviceWithStore();
    const result = await sessions.create({
      title: "Empty",
      questions: [],
    });

    expect(result).toMatchObject({
      code: "invalid_questions",
      status: 400,
      message: "Need at least one question",
      issues: [
        {
          code: "questions_required",
          message: "Need at least one question",
        },
      ],
    });
    expect(result).not.toHaveProperty("answerUrl");
  });

  it("Names the question when allowComment is set without a shape", async () => {
    const { sessions } = serviceWithStore();
    const result = await sessions.create({
      title: "Notes",
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
      message:
        "Question villain: allowComment is only valid on a choice, items, or fields question",
      issues: [
        {
          questionId: "villain",
          code: "comment_needs_shape",
        },
      ],
    });
    expect(result).not.toHaveProperty("answerUrl");
  });

  it("Lists every bad question and puts the first rule in the message", async () => {
    const { sessions } = serviceWithStore();
    const result = await sessions.create({
      questions: [
        {
          id: "villain",
          prompt: "Comment?",
          allowComment: true,
        },
        {
          id: "rows",
          prompt: "One row",
          items: [{ id: "a", label: "A" }],
        },
      ],
    });
    expect(result).toMatchObject({
      code: "invalid_questions",
      status: 400,
      message:
        "Question villain: allowComment is only valid on a choice, items, or fields question",
    });
    expect(
      (result as { issues?: Array<{ questionId?: string; code: string }> }).issues,
    ).toEqual([
      {
        questionId: "villain",
        code: "comment_needs_shape",
        message:
          "allowComment is only valid on a choice, items, or fields question",
      },
      {
        questionId: "rows",
        code: "items_min",
        message: "Item questions need two to sixteen rows",
      },
    ]);
  });
});

describe("B22 — Agent can hint a theme", () => {
  it("Stores appearance and returns it on the public view", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({
      questions: usableQuestions,
      appearance: { mode: "light", accent: "#2563eb" },
    });
    const view = await sessions.getForPublic({
      sessionId: "session-1",
      publicToken: "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(view).toMatchObject({
      appearance: { mode: "light", accent: "#2563eb" },
    });
  });

  it("Stores a named theme", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({
      questions: usableQuestions,
      appearance: { theme: "grove" },
    });
    const view = await sessions.getForPublic({
      sessionId: "session-1",
      publicToken: "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(view).toMatchObject({
      appearance: { theme: "grove" },
    });
  });

  it("Refuses an unusable accent colour", async () => {
    const { sessions } = serviceWithStore();
    const result = await sessions.create({
      questions: usableQuestions,
      appearance: { accent: "blue" },
    });
    expect(result).toMatchObject({
      code: "invalid_appearance",
      status: 400,
    });
    expect(result).not.toHaveProperty("answerUrl");
  });

  it("Refuses an unknown theme name", async () => {
    const { sessions } = serviceWithStore();
    const result = await sessions.create({
      questions: usableQuestions,
      appearance: { theme: "rainbow" },
    });
    expect(result).toMatchObject({
      code: "invalid_appearance",
      status: 400,
    });
  });
});

describe("B23 — A machine can read the questions as markdown", () => {
  it("Returns markdown with options and no agent secret", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ title: "Naming", questions: usableQuestions });
    const markdown = await sessions.markdownForPublic({
      sessionId: "session-1",
      publicToken: "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(typeof markdown).toBe("string");
    if (typeof markdown !== "string") {
      return;
    }
    expect(markdown).toContain("### Q1");
    expect(markdown).toContain("`1`: askmeatsack.com");
    expect(markdown).toContain(".md?t=");
    expect(markdown).not.toContain("agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  });

  it("Refuses markdown without the public token", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const result = await sessions.markdownForPublic({
      sessionId: "session-1",
      publicToken: "wrong",
    });
    expect(result).toMatchObject({ code: "not_found", status: 404 });
  });
});

describe("B24 — A machine can answer with JSON", () => {
  it("Saves and submits in one PUT", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const result = await sessions.saveAnswers({
      sessionId: "session-1",
      publicToken: "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      body: {
        answers: { Q1: { selectedOptionIds: ["1"] } },
        submit: true,
      },
    });
    expect(result).toMatchObject({
      submitted: { status: "submitted" },
    });
  });
});

describe("B25 — Questions may accept files", () => {
  it("Attaches a file when the question allows it", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({
      questions: [
        {
          id: "Q1",
          prompt: "Attach the notes",
          options: [],
          allowFiles: true,
        },
      ],
    });
    const result = await sessions.attachFile({
      sessionId: "session-1",
      publicToken: "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      questionId: "Q1",
      filename: "notes.txt",
      contentType: "text/plain",
      size: 12,
      storageKey: "askmeatsack/session-1/Q1/ab12-notes.txt",
    });
    expect(result).toMatchObject({
      file: {
        filename: "notes.txt",
        key: "askmeatsack/session-1/Q1/ab12-notes.txt",
        url: "https://askmeatsack.com/api/v1/sessions/session-1/files/agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb?t=public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    });
    const fetched = await sessions.readPublicFile({
      sessionId: "session-1",
      publicToken: "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      fileId: "agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(fetched).toMatchObject({
      filename: "notes.txt",
      key: "askmeatsack/session-1/Q1/ab12-notes.txt",
    });
  });

  it("Refuses a file when the question does not allow it", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const result = await sessions.attachFile({
      sessionId: "session-1",
      publicToken: "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      questionId: "Q1",
      filename: "notes.txt",
      contentType: "text/plain",
      size: 12,
      storageKey: "askmeatsack/session-1/Q1/ab12-notes.txt",
    });
    expect(result).toMatchObject({
      code: "invalid_answer",
      status: 400,
    });
  });
});

describe("B10 — The two links have different powers", () => {
  it("Public token is not enough to read agent status", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const result = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken: "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      hasCreateCredential: false,
    });
    expect(result).toMatchObject({ code: "not_found", status: 404 });
  });
});

describe("B12 — A broken or unknown link does not leak another questionnaire", () => {
  it("Unknown session id does not return questions", async () => {
    const { sessions } = serviceWithStore();
    const result = await sessions.getForAgent({
      sessionId: "missing",
      agentToken: "agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      hasCreateCredential: false,
    });
    expect(result).toMatchObject({ code: "not_found", status: 404 });
    expect(result).not.toHaveProperty("questions");
  });

  it("Wrong agent token on a real session does not leak that questionnaire", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const result = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken: "junk-token-cccccccccccccccccccccccccccccccc",
      hasCreateCredential: false,
    });
    expect(result).toMatchObject({ code: "not_found", status: 404 });
    expect(result).not.toHaveProperty("questions");
  });

  it("Agent token returns pending status and empty answers", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const result = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken: "agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      hasCreateCredential: false,
    });
    expect(result).toMatchObject({
      sessionId: "session-1",
      status: "pending",
      answers: {},
      progress: {
        totalCount: 1,
        answeredCount: 0,
        questionIdsAnswered: [],
      },
    });
  });
});

const publicToken = "public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const agentToken = "agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const twoRequiredQuestions = [
  ...usableQuestions,
  {
    id: "Q2",
    prompt: "Second?",
    options: [
      { id: "1", label: "Yes" },
      { id: "2", label: "No" },
    ],
  },
];

describe("B3 — Answers are kept as they go", () => {
  it("F1.T5 — A valid option is saved and progress updates", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const saved = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    expect(saved).toMatchObject({
      questionId: "Q1",
      progress: { answeredCount: 1, totalCount: 1, questionIdsAnswered: ["Q1"] },
    });
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({
      status: "in_progress",
      answers: { Q1: { selectedOptionIds: ["1"] } },
    });
  });
});

describe("B9 — A bad answer is refused", () => {
  it("F1.T6 — An option that is not on the question is refused and the previous answer is unchanged", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    const refused = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["nope"] },
    });
    expect(refused).toMatchObject({ code: "invalid_answer", status: 400 });
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({
      answers: { Q1: { selectedOptionIds: ["1"] } },
    });
  });

  it("Several options on a single-choice question are refused", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const refused = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1", "2"] },
    });
    expect(refused).toMatchObject({ code: "invalid_answer", status: 400 });
  });
});

describe("B5 — Submit once, then answers freeze", () => {
  it("F1.T7 — Submit with every required question answered freezes answers", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    const submitted = await sessions.submit({ sessionId: "session-1", publicToken });
    expect(submitted).toMatchObject({
      status: "submitted",
      answers: { Q1: { selectedOptionIds: ["1"] } },
    });
    const again = await sessions.submit({ sessionId: "session-1", publicToken });
    expect(again).toMatchObject({
      status: "submitted",
      answers: { Q1: { selectedOptionIds: ["1"] } },
    });
    const saveAfter = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["2"] },
    });
    expect(saveAfter).toMatchObject({ code: "frozen", status: 409 });
  });
});

describe("B6 — Cannot submit until required questions are answered", () => {
  it("F1.T8 — Submit is refused when a required question has no answer", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: twoRequiredQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    const refused = await sessions.submit({ sessionId: "session-1", publicToken });
    expect(refused).toMatchObject({
      code: "required_unanswered",
      status: 400,
    });
    expect(JSON.stringify(refused)).toContain("Q2");
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({ status: "in_progress" });
  });
});

describe("B10 — Public token is required to save and submit", () => {
  it("Agent token cannot save an answer", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const refused = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken: agentToken,
      body: { selectedOptionIds: ["1"] },
    });
    expect(refused).toMatchObject({ code: "not_found", status: 404 });
  });
});

describe("B2 — Human opens one page of questions", () => {
  it("F1.T1 — A valid public token loads the questions without the agent secret", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({
      title: "Naming",
      context: "Pick a name",
      questions: usableQuestions,
    });
    const view = await sessions.getForPublic({ sessionId: "session-1", publicToken });
    expect(humanScreenFor(view)).toBe("answering");
    expect(view).toMatchObject({
      sessionId: "session-1",
      status: "pending",
      title: "Naming",
      context: "Pick a name",
      questions: usableQuestions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
      })),
    });
    expect(JSON.stringify(view)).not.toContain(agentToken);
    expect(view).not.toHaveProperty("agentToken");
    expect(view).not.toHaveProperty("publicToken");
    expect(view).not.toHaveProperty("metadata");
  });

  it("Opaque metadata is returned to the agent and not to the human", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({
      questions: usableQuestions,
      metadata: { repo: "askmeatproxy", run: "1" },
    });
    const agent = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    const human = await sessions.getForPublic({
      sessionId: "session-1",
      publicToken,
    });
    expect(agent).toMatchObject({
      metadata: { repo: "askmeatproxy", run: "1" },
    });
    expect(human).not.toHaveProperty("metadata");
  });
});

describe("B12 — Unknown or wrong public token shows nothing", () => {
  it("F1.T2 — A wrong public token does not return questions", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const view = await sessions.getForPublic({
      sessionId: "session-1",
      publicToken: agentToken,
    });
    expect(humanScreenFor(view)).toBe("unknown_link");
    expect(view).toMatchObject({ code: "not_found", status: 404 });
    expect(view).not.toHaveProperty("questions");
  });
});

describe("B11 — Opening a submitted link shows it is finished", () => {
  it("F1.T4 — After submit, the public view is submitted_view", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    await sessions.submit({ sessionId: "session-1", publicToken });
    const view = await sessions.getForPublic({ sessionId: "session-1", publicToken });
    expect(humanScreenFor(view)).toBe("submitted_view");
    expect(view).toMatchObject({ status: "submitted" });
  });
});

describe("B3 — Leave and return still shows saved answers", () => {
  it("F1.T10 — Saved answers are still on the public view", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["2"] },
    });
    const view = await sessions.getForPublic({ sessionId: "session-1", publicToken });
    expect(humanScreenFor(view)).toBe("answering");
    expect(view).toMatchObject({
      answers: { Q1: { selectedOptionIds: ["2"] } },
    });
  });
});

describe("B8 — The link expires", () => {
  it("F1.T3 — Opening after expiry shows expired_view", async () => {
    const { sessions, setNow } = serviceWithStore();
    await sessions.create({ questions: usableQuestions, expiresInSeconds: 60 });
    setNow(new Date("2026-08-16T20:01:00.000Z"));
    const view = await sessions.getForPublic({ sessionId: "session-1", publicToken });
    expect(humanScreenFor(view)).toBe("expired_view");
    expect(view).toMatchObject({ status: "expired" });
  });

  it("F1.T9 — After time runs out, answers cannot be changed or submitted", async () => {
    const { sessions, setNow } = serviceWithStore();
    await sessions.create({ questions: usableQuestions, expiresInSeconds: 60 });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    setNow(new Date("2026-08-16T20:01:00.000Z"));
    const view = await sessions.getForPublic({ sessionId: "session-1", publicToken });
    expect(humanScreenFor(view)).toBe("expired_view");
    const saveAfter = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["2"] },
    });
    expect(saveAfter).toMatchObject({ code: "expired", status: 409 });
    const submitAfter = await sessions.submit({ sessionId: "session-1", publicToken });
    expect(submitAfter).toMatchObject({ code: "expired", status: 409 });
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({
      answers: { Q1: { selectedOptionIds: ["1"] } },
    });
  });

  it("F2.T4 — Agent status after expiry is expired with saved answers", async () => {
    const { sessions, setNow } = serviceWithStore();
    await sessions.create({ questions: usableQuestions, expiresInSeconds: 60 });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    setNow(new Date("2026-08-16T20:01:00.000Z"));
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({
      status: "expired",
      answers: { Q1: { selectedOptionIds: ["1"] } },
    });
  });

  it("After the one-hour read window the expired questionnaire is gone", async () => {
    const { sessions, setNow } = serviceWithStore();
    await sessions.create({ questions: usableQuestions, expiresInSeconds: 60 });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    setNow(new Date("2026-08-16T21:01:00.000Z"));
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({ code: "not_found", status: 404 });
    const view = await sessions.getForPublic({ sessionId: "session-1", publicToken });
    expect(humanScreenFor(view)).toBe("unknown_link");
  });

  it("After the one-hour read window a submitted questionnaire is gone", async () => {
    const { sessions, setNow } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    await sessions.submit({ sessionId: "session-1", publicToken });
    setNow(new Date("2026-08-16T21:00:00.000Z"));
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({ code: "not_found", status: 404 });
  });

  it("A submitted questionnaire is not expired when the original expiry time passes", async () => {
    const { sessions, setNow } = serviceWithStore();
    await sessions.create({ questions: usableQuestions, expiresInSeconds: 60 });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    await sessions.submit({ sessionId: "session-1", publicToken });
    setNow(new Date("2026-08-16T20:01:00.000Z"));
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({ status: "submitted" });
  });
});

describe("B14 — The page tells the agent it is actually open", () => {
  it("F1.T12 — Marking opened records the time and stays pending", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const opened = await sessions.markOpened({ sessionId: "session-1", publicToken });
    expect(opened).toMatchObject({
      openedAt: "2026-08-16T20:00:00.000Z",
      status: "pending",
    });
    const again = await sessions.markOpened({ sessionId: "session-1", publicToken });
    expect(again).toMatchObject({
      openedAt: "2026-08-16T20:00:00.000Z",
      status: "pending",
    });
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({
      status: "pending",
      openedAt: "2026-08-16T20:00:00.000Z",
      answers: {},
    });
  });

  it("Agent token cannot mark opened", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const refused = await sessions.markOpened({
      sessionId: "session-1",
      publicToken: agentToken,
    });
    expect(refused).toMatchObject({ code: "not_found", status: 404 });
  });
});

describe("B17 — Human or agent can cancel while it is open", () => {
  it("F1.T15 / F2.T11 — Cancel while open becomes cancelled and answers freeze", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    const cancelled = await sessions.cancel({
      sessionId: "session-1",
      publicToken,
      hasCreateCredential: false,
    });
    expect(cancelled).toMatchObject({
      status: "cancelled",
      answers: { Q1: { selectedOptionIds: ["1"] } },
    });
    const again = await sessions.cancel({
      sessionId: "session-1",
      publicToken,
      hasCreateCredential: false,
    });
    expect(again).toMatchObject({
      status: "cancelled",
      answers: { Q1: { selectedOptionIds: ["1"] } },
    });
    const saveAfter = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["2"] },
    });
    expect(saveAfter).toMatchObject({ code: "frozen", status: 409 });
    const view = await sessions.getForPublic({ sessionId: "session-1", publicToken });
    expect(humanScreenFor(view)).toBe("cancelled_view");
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({
      status: "cancelled",
      answers: { Q1: { selectedOptionIds: ["1"] } },
    });
  });

  it("F1.T11 — Opening a cancelled link shows cancelled_view", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    await sessions.cancel({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    const view = await sessions.getForPublic({ sessionId: "session-1", publicToken });
    expect(humanScreenFor(view)).toBe("cancelled_view");
  });

  it("F2.T12 — Cancel after submit is refused and status stays submitted", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    await sessions.submit({ sessionId: "session-1", publicToken });
    const refused = await sessions.cancel({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(refused).toMatchObject({ code: "frozen", status: 409 });
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({ status: "submitted" });
  });

  it("F2.T12 — Cancel after expiry is refused and status stays expired", async () => {
    const { sessions, setNow } = serviceWithStore();
    await sessions.create({ questions: usableQuestions, expiresInSeconds: 60 });
    setNow(new Date("2026-08-16T20:01:00.000Z"));
    const refused = await sessions.cancel({
      sessionId: "session-1",
      publicToken,
      hasCreateCredential: false,
    });
    expect(refused).toMatchObject({ code: "frozen", status: 409 });
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({ status: "expired" });
  });

  it("A junk token cannot cancel another questionnaire", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const refused = await sessions.cancel({
      sessionId: "session-1",
      publicToken: "junk-token-cccccccccccccccccccccccccccccccc",
      hasCreateCredential: false,
    });
    expect(refused).toMatchObject({ code: "not_found", status: 404 });
  });
});

const mixedQuestions = [
  {
    id: "Q1",
    prompt: "What should we call this?",
    options: [
      { id: "1", label: "askmeatsack.com" },
      { id: "2", label: "Something else" },
    ],
    recommendedOptionId: "1",
  },
  {
    id: "Q2",
    prompt: "Anything else?",
  },
  {
    id: "Q3",
    prompt: "Pick a tone and add a note",
    options: [
      { id: "calm", label: "Calm" },
      { id: "direct", label: "Direct" },
    ],
    allowComment: true,
    required: false,
  },
];

describe("B15 — A recommended option is marked", () => {
  it("A recommended option that is not on the question is refused at create", async () => {
    const { sessions } = serviceWithStore();
    const result = await sessions.create({
      questions: [
        {
          id: "Q1",
          prompt: "Name?",
          options: [
            { id: "1", label: "A" },
            { id: "2", label: "B" },
          ],
          recommendedOptionId: "nope",
        },
      ],
    });
    expect(result).toMatchObject({
      code: "invalid_questions",
      status: 400,
      message:
        "Question Q1: Recommended option must belong to the question",
      issues: [
        {
          questionId: "Q1",
          code: "recommended_unknown",
        },
      ],
    });
  });

  it("Public view includes the recommended mark and does not preselect it", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: mixedQuestions });
    const view = await sessions.getForPublic({ sessionId: "session-1", publicToken });
    expect(view).toMatchObject({ answers: {} });
    expect(humanScreenFor(view)).toBe("answering");
    if ("questions" in view) {
      expect(view.questions[0]?.recommendedOptionId).toBe("1");
    }
  });
});

describe("B26 — A question may carry extra material", () => {
  it("Public view includes question detail markdown", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({
      questions: [
        {
          id: "Q1",
          prompt: "What do you think of this?",
          detail: "```mermaid\nflowchart LR\n  a --> b\n```",
          options: [
            { id: "yes", label: "Yes" },
            { id: "no", label: "No" },
          ],
        },
      ],
    });
    const view = await sessions.getForPublic({
      sessionId: "session-1",
      publicToken,
    });
    if ("questions" in view) {
      expect(view.questions[0]?.detail).toContain("mermaid");
    }
  });
});

describe("B16 — Questions may be choices, text, or both", () => {
  it("F1.T13 — Non-empty text on a text question is saved", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: mixedQuestions });
    const saved = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q2",
      publicToken,
      body: { text: "Ship it as askmeatsack.com" },
    });
    expect(saved).toMatchObject({
      questionId: "Q2",
      progress: { questionIdsAnswered: ["Q2"] },
    });
  });

  it("A comment on a choice that allows it is saved with the choice", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: mixedQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q3",
      publicToken,
      body: { selectedOptionIds: ["calm"] },
    });
    const saved = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q3",
      publicToken,
      body: { text: "Keep the copy short" },
    });
    expect(saved).toMatchObject({ questionId: "Q3" });
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({
      answers: {
        Q3: { selectedOptionIds: ["calm"], text: "Keep the copy short" },
      },
    });
  });
});

describe("B9 — Text and comment rules", () => {
  it("F1.T14 — Text on a choice that does not allow a comment is refused", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: mixedQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    const refused = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { text: "nope" },
    });
    expect(refused).toMatchObject({ code: "invalid_answer", status: 400 });
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({
      answers: { Q1: { selectedOptionIds: ["1"] } },
    });
  });

  it("F1.T14 — Options on a text question are refused", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: mixedQuestions });
    const refused = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q2",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    expect(refused).toMatchObject({ code: "invalid_answer", status: 400 });
  });

  it("F1.T14 — Text over 2000 characters is refused", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: mixedQuestions });
    const refused = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q2",
      publicToken,
      body: { text: "a".repeat(2001) },
    });
    expect(refused).toMatchObject({ code: "invalid_answer", status: 400 });
  });
});

describe("B6 — Required text must be answered", () => {
  it("Submit is refused when required text is empty", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: mixedQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    const refused = await sessions.submit({ sessionId: "session-1", publicToken });
    expect(refused).toMatchObject({ code: "required_unanswered", status: 400 });
    expect(JSON.stringify(refused)).toContain("Q2");
  });
});

describe("B19 — Human can download the answers", () => {
  it("F1.T7 — After submit, download includes labels and ids and not the agent secret", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ title: "Naming", questions: mixedQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q2",
      publicToken,
      body: { text: "Ship it" },
    });
    await sessions.submit({ sessionId: "session-1", publicToken });
    const file = await sessions.downloadForPublic({
      sessionId: "session-1",
      publicToken,
    });
    expect(file).toMatchObject({
      sessionId: "session-1",
      title: "Naming",
      status: "submitted",
    });
    if ("answers" in file) {
      expect(file.answers).toEqual(
        expect.arrayContaining([
          {
            questionId: "Q1",
            prompt: "What should we call this?",
            selectedOptionIds: ["1"],
            selectedLabels: ["askmeatsack.com"],
          },
          {
            questionId: "Q2",
            prompt: "Anything else?",
            selectedOptionIds: [],
            selectedLabels: [],
            text: "Ship it",
          },
        ]),
      );
    }
    expect(JSON.stringify(file)).not.toContain(agentToken);
    expect(file).not.toHaveProperty("agentToken");
  });

  it("Download is refused while the questionnaire is still open", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: mixedQuestions });
    const refused = await sessions.downloadForPublic({
      sessionId: "session-1",
      publicToken,
    });
    expect(refused).toMatchObject({ code: "not_available", status: 409 });
  });
});

describe("B13 — Agent can wait a bounded time", () => {
  it("F2.T10 — Wait on an open session returns current progress when the bound ends", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const result = await sessions.wait({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
      body: { seconds: 2 },
    });
    expect(result).toMatchObject({
      status: "pending",
      answers: {},
    });
  });

  it("F2.T7 — Wait returns submitted if submit happens within the bound", async () => {
    let submitOnce = false;
    const { sessions } = serviceWithStore({
      onSleep: async () => {
        if (submitOnce) {
          return;
        }
        submitOnce = true;
        await sessions.submit({ sessionId: "session-1", publicToken });
      },
    });
    await sessions.create({ questions: usableQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    const result = await sessions.wait({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
      body: { seconds: 2 },
    });
    expect(result).toMatchObject({
      status: "submitted",
      answers: { Q1: { selectedOptionIds: ["1"] } },
    });
  });

  it("F2.T8 — Wait returns expired if expiry happens within the bound", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions, expiresInSeconds: 1 });
    const result = await sessions.wait({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
      body: { seconds: 2 },
    });
    expect(result).toMatchObject({ status: "expired" });
  });

  it("F2.T9 — Wait returns cancelled if cancel happens within the bound", async () => {
    let cancelOnce = false;
    const { sessions } = serviceWithStore({
      onSleep: async () => {
        if (cancelOnce) {
          return;
        }
        cancelOnce = true;
        await sessions.cancel({
          sessionId: "session-1",
          agentToken,
          hasCreateCredential: false,
        });
      },
    });
    await sessions.create({ questions: usableQuestions });
    const result = await sessions.wait({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
      body: { seconds: 2 },
    });
    expect(result).toMatchObject({ status: "cancelled" });
  });

  it("A bound over the maximum is refused", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const result = await sessions.wait({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
      body: { seconds: 61 },
    });
    expect(result).toMatchObject({ code: "invalid_bound", status: 400 });
  });

  it("A public token cannot wait", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const result = await sessions.wait({
      sessionId: "session-1",
      agentToken: publicToken,
      hasCreateCredential: false,
      body: { seconds: 1 },
    });
    expect(result).toMatchObject({ code: "not_found", status: 404 });
  });
});

describe("B18 — Agent can be called back on a terminal status", () => {
  it("Submit posts the session id, status, and answers once", async () => {
    const { sessions, callbackCalls } = serviceWithStore();
    await sessions.create({
      questions: usableQuestions,
      callbackUrl: "https://example.com/hook",
    });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    await sessions.submit({ sessionId: "session-1", publicToken });
    await sessions.submit({ sessionId: "session-1", publicToken });
    expect(callbackCalls).toEqual([
      {
        url: "https://example.com/hook",
        body: {
          sessionId: "session-1",
          status: "submitted",
          answers: {
            Q1: {
              selectedOptionIds: ["1"],
              answeredAt: "2026-08-16T20:00:00.000Z",
            },
          },
        },
      },
    ]);
  });

  it("A failing callback still leaves the session submitted", async () => {
    const { sessions } = serviceWithStore({
      postCallback: async () => {
        throw new Error("callback failed");
      },
    });
    await sessions.create({
      questions: usableQuestions,
      callbackUrl: "https://example.com/hook",
    });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    const submitted = await sessions.submit({ sessionId: "session-1", publicToken });
    expect(submitted).toMatchObject({ status: "submitted" });
    const poll = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(poll).toMatchObject({ status: "submitted" });
  });

  it("Expiry posts the terminal callback once", async () => {
    const { sessions, callbackCalls, setNow } = serviceWithStore();
    await sessions.create({
      questions: usableQuestions,
      callbackUrl: "https://example.com/hook",
      expiresInSeconds: 60,
    });
    setNow(new Date("2026-08-16T20:01:00.000Z"));
    await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(callbackCalls).toHaveLength(1);
    expect(callbackCalls[0]).toMatchObject({
      url: "https://example.com/hook",
      body: { sessionId: "session-1", status: "expired" },
    });
  });

  it("Cancel posts the terminal callback once", async () => {
    const { sessions, callbackCalls } = serviceWithStore();
    await sessions.create({
      questions: usableQuestions,
      callbackUrl: "https://example.com/hook",
    });
    await sessions.cancel({
      sessionId: "session-1",
      publicToken,
      hasCreateCredential: false,
    });
    expect(callbackCalls).toHaveLength(1);
    expect(callbackCalls[0]).toMatchObject({
      body: { sessionId: "session-1", status: "cancelled" },
    });
  });

  it("Submit waits for a slow callback before it returns", async () => {
    // Fire-and-forget used to return before the POST ran, so serverless froze it.
    let released = false;
    const { sessions } = serviceWithStore({
      postCallback: async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 25);
        });
        released = true;
      },
    });
    await sessions.create({
      questions: usableQuestions,
      callbackUrl: "https://example.com/hook",
    });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    await sessions.submit({ sessionId: "session-1", publicToken });
    expect(released).toBe(true);
  });

  it("An invalid callback URL is refused at create", async () => {
    const { sessions } = serviceWithStore();
    const result = await sessions.create({
      questions: usableQuestions,
      callbackUrl: "not-a-url",
    });
    expect(result).toMatchObject({ code: "invalid_questions", status: 400 });
  });
});

describe("B27 — Owner can inspect on a private manage link", () => {
  it("F3.T1 — Manage markdown lists the questions and the public answer link", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({
      title: "Naming",
      context: "Pick a name",
      questions: usableQuestions,
    });
    const markdown = await sessions.markdownForManage({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(markdown).toContain("Naming");
    expect(markdown).toContain("Pick a name");
    expect(markdown).toContain("What should we call this?");
    expect(markdown).toContain(
      "https://askmeatsack.com/s/session-1?t=public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(markdown).toContain("Nobody has answered yet");
    const agent = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(agent).toMatchObject({
      context: "Pick a name",
      answerUrl:
        "https://askmeatsack.com/s/session-1?t=public-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      manageUrl:
        "https://askmeatsack.com/s/session-1/manage?token=agent-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
  });

  it("F3.T2 — A public token does not open the manage summary", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    const markdown = await sessions.markdownForManage({
      sessionId: "session-1",
      agentToken: publicToken,
      hasCreateCredential: false,
    });
    expect(markdown).toMatchObject({ code: "not_found", status: 404 });
  });
});

describe("B28 — Owner can edit before anyone answers", () => {
  it("F3.T3 — Edit while pending replaces questions and keeps the answer link", async () => {
    const { sessions } = serviceWithStore();
    const created = await sessions.create({
      title: "Naming",
      questions: usableQuestions,
    });
    const updated = await sessions.update({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
      body: {
        title: "Renamed",
        questions: [
          {
            id: "Q2",
            prompt: "Ship it?",
            options: [
              { id: "yes", label: "Yes" },
              { id: "no", label: "Not yet" },
            ],
          },
        ],
      },
    });
    expect(updated).toMatchObject({
      title: "Renamed",
      status: "pending",
      questions: [{ id: "Q2", prompt: "Ship it?" }],
    });
    expect(created).toMatchObject({
      answerUrl: (updated as { answerUrl: string }).answerUrl,
    });
    const publicView = await sessions.getForPublic({
      sessionId: "session-1",
      publicToken,
    });
    expect(publicView).toMatchObject({
      title: "Renamed",
      questions: [{ id: "Q2", prompt: "Ship it?" }],
    });
    expect(JSON.stringify(publicView)).not.toContain(agentToken);
  });

  it("F3.T4 — Edit after an answer is refused", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: usableQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "Q1",
      publicToken,
      body: { selectedOptionIds: ["1"] },
    });
    const result = await sessions.update({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
      body: { title: "Too late" },
    });
    expect(result).toMatchObject({ code: "not_editable", status: 409 });
    const agent = await sessions.getForAgent({
      sessionId: "session-1",
      agentToken,
      hasCreateCredential: false,
    });
    expect(agent).toMatchObject({ title: undefined, status: "in_progress" });
  });
});

describe("B32 — labelled rows and named fields", () => {
  const itemQuestions = [
    {
      id: "bucks",
      prompt: "Please label these lines.",
      items: [
        { id: "feb_dd", label: "Feb DD" },
        { id: "feb_card", label: "Feb card" },
      ],
    },
  ];

  it("saves entries on an item question", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: itemQuestions });
    const saved = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "bucks",
      publicToken,
      body: { entries: { feb_dd: "rent", feb_card: "card" } },
    });
    expect(saved).toMatchObject({
      progress: { answeredCount: 1, requiredAnsweredCount: 1 },
    });
    const view = await sessions.getForPublic({
      sessionId: "session-1",
      publicToken,
    });
    expect(view).toMatchObject({
      answers: {
        bucks: { entries: { feb_dd: "rent", feb_card: "card" } },
      },
    });
  });

  it("refuses an unknown entry id and mixing items with options", async () => {
    const { sessions } = serviceWithStore();
    const mixed = await sessions.create({
      questions: [
        {
          id: "bad",
          prompt: "Nope",
          options: [
            { id: "yes", label: "Yes" },
            { id: "no", label: "No" },
          ],
          items: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
        },
      ],
    });
    expect(mixed).toMatchObject({
      code: "invalid_questions",
      status: 400,
      message: "Question bad: A question cannot mix options, items, and fields",
      issues: [{ questionId: "bad", code: "mixed_shapes" }],
    });

    await sessions.create({ questions: itemQuestions });
    const unknown = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "bucks",
      publicToken,
      body: { entries: { mystery: "nope" } },
    });
    expect(unknown).toMatchObject({ code: "invalid_answer", status: 400 });
  });

  it("blocks submit until every required row is filled", async () => {
    const { sessions } = serviceWithStore();
    await sessions.create({ questions: itemQuestions });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "bucks",
      publicToken,
      body: { entries: { feb_dd: "rent" } },
    });
    const refused = await sessions.submit({
      sessionId: "session-1",
      publicToken,
    });
    expect(refused).toMatchObject({ code: "required_unanswered", status: 400 });
    await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "bucks",
      publicToken,
      body: { entries: { feb_dd: "rent", feb_card: "card" } },
    });
    const submitted = await sessions.submit({
      sessionId: "session-1",
      publicToken,
    });
    expect(submitted).toMatchObject({ status: "submitted" });
  });

  it("normalises money entries and refuses junk", async () => {
    const { sessions } = serviceWithStore();
    const created = await sessions.create({
      questions: [
        {
          id: "hmrc",
          prompt: "How much is still owed?",
          currency: "GBP",
          fields: [
            { id: "vat", label: "VAT", input: "money" },
            { id: "paye", label: "PAYE", input: "money" },
          ],
        },
      ],
    });
    expect(created).not.toHaveProperty("code");

    const saved = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "hmrc",
      publicToken,
      body: { entries: { vat: "£1,200.5", paye: "80" } },
    });
    expect(saved).toMatchObject({
      progress: { answeredCount: 1, requiredAnsweredCount: 1 },
    });
    const view = await sessions.getForPublic({
      sessionId: "session-1",
      publicToken,
    });
    expect(view).toMatchObject({
      answers: {
        hmrc: { entries: { vat: "1200.50", paye: "80.00" } },
      },
    });

    const refused = await sessions.saveAnswer({
      sessionId: "session-1",
      questionId: "hmrc",
      publicToken,
      body: { entries: { vat: "about a grand", paye: "80" } },
    });
    expect(refused).toMatchObject({ code: "invalid_answer", status: 400 });
  });

  it("refuses money rows without a currency", async () => {
    const { sessions } = serviceWithStore();
    const created = await sessions.create({
      questions: [
        {
          id: "hmrc",
          prompt: "How much is still owed?",
          fields: [
            { id: "vat", label: "VAT", input: "money" },
            { id: "paye", label: "PAYE", input: "money" },
          ],
        },
      ],
    });
    expect(created).toMatchObject({
      code: "invalid_questions",
      status: 400,
      message: "Question hmrc: Money rows need a currency",
      issues: [{ questionId: "hmrc", code: "money_needs_currency" }],
    });
  });
});

