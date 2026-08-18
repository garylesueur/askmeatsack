import { describe, expect, it } from "vitest";
import { previewTokenFor, previewTokenMatches } from "./preview-token";
import {
  expiryPhrase,
  minutesFor,
  previewSummary,
  sessionPreview,
  type PreviewSource,
} from "./session-preview";

const NOW = new Date("2026-08-18T12:00:00.000Z");

function source(over: Partial<PreviewSource> = {}): PreviewSource {
  return {
    status: "pending",
    expiresAt: "2026-08-21T12:00:00.000Z",
    title: "Expenses for July",
    context: "Finance needs these before the month closes.",
    questions: [{}, {}, {}, {}],
    ...over,
  };
}

describe("session preview", () => {
  it("summarises the ask without reaching for an answer", () => {
    const preview = sessionPreview(source(), NOW);
    expect(preview.title).toBe("Expenses for July");
    expect(preview.questionCount).toBe(4);
    expect(previewSummary(preview)).toBe("4 questions · about 2 minutes");
    expect(expiryPhrase(preview, NOW)).toBe("Expires in 3 days");
  });

  it("carries nothing from a view that does have answers", () => {
    // The shape the page hands over really does hold answers. The point of the
    // projection is that they have nowhere to land.
    const withAnswers = {
      ...source(),
      answers: { q1: { text: "My salary is 61000" } },
      progress: { answered: 1, total: 4 },
    };
    const preview = sessionPreview(withAnswers, NOW);
    expect(JSON.stringify(preview)).not.toContain("61000");
    expect(Object.keys(preview)).toEqual([
      "title",
      "context",
      "questionCount",
      "minutes",
      "state",
      "expiresAt",
    ]);
  });

  it("says a link is spent rather than describing the ask", () => {
    const submitted = sessionPreview(source({ status: "submitted" }), NOW);
    expect(previewSummary(submitted)).toBe("Already answered");
    expect(expiryPhrase(submitted, NOW)).toBeNull();

    const expired = sessionPreview(source({ expiresAt: "2026-08-17T12:00:00.000Z" }), NOW);
    expect(previewSummary(expired)).toBe("This link has expired");

    // Expired by status rather than by the clock.
    const marked = sessionPreview(source({ status: "expired" }), NOW);
    expect(previewSummary(marked)).toBe("This link has expired");
  });

  it("falls back to a title that names nobody's questionnaire", () => {
    const preview = sessionPreview(source({ title: undefined, context: undefined }), NOW);
    expect(preview.title).toBe("A few questions for you");
    expect(preview.context).toBeNull();
  });

  it("counts one question as one minute, not half of one", () => {
    expect(minutesFor(1)).toBe(1);
    expect(minutesFor(0)).toBe(1);
    expect(minutesFor(10)).toBe(5);
  });
});

describe("preview token", () => {
  const session = { sessionId: "session1", publicToken: "public-token-1" };

  it("cannot be computed from the session id alone", () => {
    const token = previewTokenFor(session);
    expect(token).not.toContain(session.publicToken);
    expect(previewTokenFor({ ...session, publicToken: "another-token" })).not.toBe(token);
  });

  it("does not accept the public token in its place", () => {
    expect(previewTokenMatches(session, session.publicToken)).toBe(false);
    expect(previewTokenMatches(session, undefined)).toBe(false);
    expect(previewTokenMatches(session, "")).toBe(false);
  });

  it("accepts the token it derived", () => {
    expect(previewTokenMatches(session, previewTokenFor(session))).toBe(true);
  });
});
