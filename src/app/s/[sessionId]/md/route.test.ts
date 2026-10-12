import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "@/app/api/v1/sessions/[sessionId]/answers/route";
import { getDefaultSessionService } from "@/lib/app-sessions";
import { createMemorySessionStore, type SessionStore } from "@/lib/session-store";
import { isSessionServiceError } from "@/lib/sessions";
import { GET } from "./route";

const state = globalThis as typeof globalThis & { askmeatsackStore?: SessionStore };
let previousStore: SessionStore | undefined;

beforeEach(() => {
  previousStore = state.askmeatsackStore;
  state.askmeatsackStore = createMemorySessionStore();
  vi.stubEnv("PUBLIC_BASE_URL", "https://askmeatsack.com");
});
afterEach(() => {
  state.askmeatsackStore = previousStore;
  vi.unstubAllEnvs();
});

async function create() {
  const session = await getDefaultSessionService().create({
    title: "Project details",
    questions: [
      {
        id: "decision",
        prompt: "Proceed?",
        options: [
          { id: "go", label: "Go" },
          { id: "wait", label: "Wait" },
        ],
      },
      { id: "notes", prompt: "Project notes?" },
      {
        id: "details",
        prompt: "Contact?",
        fields: [
          { id: "name", label: "Name" },
          { id: "role", label: "Role" },
        ],
      },
    ],
  });
  if (isSessionServiceError(session)) throw new Error(session.message);
  return { session, context: { params: Promise.resolve({ sessionId: session.sessionId }) } };
}

describe("B23/B24 — a respondent's agent reads and answers over HTTP", () => {
  it("reads all questions, resumes a saved answer, and submits mixed answers in one PUT", async () => {
    const { session, context } = await create();
    const token = new URL(session.answerUrl).searchParams.get("t")!;
    const answersUrl = `https://askmeatsack.com/api/v1/sessions/${session.sessionId}/answers?t=${token}`;
    const put = (body: unknown) =>
      PUT(
        new Request(answersUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        context,
      );
    // An incomplete submit returns an error but keeps valid draft answers.
    const draft = await put({
      answers: { notes: { text: "Notes from the respondent's agent" } },
      submit: true,
    });
    expect(draft.status).toBe(400);
    expect(await draft.json()).toMatchObject({ error: { code: "required_unanswered" } });
    const document = await GET(new Request(session.machineUrl), context);
    expect(document.status).toBe(200);
    expect(document.headers.get("Content-Type")).toContain("text/markdown");
    expect(document.headers.get("Cache-Control")).toContain("no-store");
    expect(document.headers.get("X-Robots-Tag")).toContain("noindex");
    const markdown = await document.text();
    for (const id of ["decision", "notes", "details"]) expect(markdown).toContain(`### ${id}`);
    expect(markdown).toContain("Status: `in_progress`");
    expect(markdown).toContain("Notes from the respondent's agent");
    expect(markdown).toContain(`PUT ${answersUrl}`);
    expect(markdown).not.toContain(new URL(session.manageUrl).searchParams.get("token")!);

    const submitted = await put({
      answers: {
        decision: { selectedOptionIds: ["go"] },
        notes: { text: "Notes from the respondent's agent" },
        details: { entries: { name: "Alex", role: "Engineer" } },
      },
      submit: true,
    });
    expect(submitted.status).toBe(200);
    expect(await submitted.json()).toMatchObject({
      submitted: {
        status: "submitted",
        answers: {
          decision: { selectedOptionIds: ["go"] },
          notes: { text: "Notes from the respondent's agent" },
          details: { entries: { name: "Alex", role: "Engineer" } },
        },
      },
    });
    const finished = await GET(new Request(session.machineUrl), context);
    expect(await finished.text()).toContain("This questionnaire is closed");
  });

  it("refuses question reads and bulk writes with another token", async () => {
    const { session, context } = await create();
    const document = await GET(
      new Request(`https://askmeatsack.com/s/${session.sessionId}.md?t=wrong`),
      context,
    );
    expect(document.status).toBe(404);
    expect(await document.text()).not.toContain("Project details");
    const response = await PUT(
      new Request(`https://askmeatsack.com/api/v1/sessions/${session.sessionId}/answers?t=wrong`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: { notes: { text: "Not authorised" } }, submit: true }),
      }),
      context,
    );
    expect(response.status).toBe(404);
    const correct = await GET(new Request(session.machineUrl), context);
    expect(await correct.text()).not.toContain("Not authorised");
  });
});
