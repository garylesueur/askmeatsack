import { describe, expect, it } from "vitest";
import { machineQuestionnairePath, wantsAnswerMarkdown } from "./answer-document";

describe("answer document negotiation", () => {
  it("does not treat a browser Accept as markdown", () => {
    expect(
      wantsAnswerMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
    ).toBe(false);
    expect(wantsAnswerMarkdown("*/*")).toBe(false);
    expect(wantsAnswerMarkdown(null)).toBe(false);
  });

  it("treats markdown or plain Accept as the machine form", () => {
    expect(wantsAnswerMarkdown("text/markdown")).toBe(true);
    expect(wantsAnswerMarkdown("text/plain, */*")).toBe(true);
  });

  it("keeps the public token on the .md path", () => {
    expect(machineQuestionnairePath("abc", "tok")).toBe("/s/abc.md?t=tok");
  });

  it("B23 — honours media preferences and refuses disabled Markdown", () => {
    expect(wantsAnswerMarkdown("text/markdown;q=0, text/html")).toBe(false);
    expect(wantsAnswerMarkdown("text/plain;q=0, */*")).toBe(false);
    expect(wantsAnswerMarkdown("text/markdown, text/html;q=0.5")).toBe(true);
    expect(wantsAnswerMarkdown("text/markdown;q=0.5, text/html")).toBe(false);
    expect(wantsAnswerMarkdown("text/plain, text/html;q=0")).toBe(true);
    expect(wantsAnswerMarkdown("text/markdown, text/html")).toBe(false);
  });

  it.each([
    ["text/markdown; q = 0, text/html;q=0.5", false],
    ["text/markdown; q= 0, text/html;q=0.5", false],
    ["text/plain;\tQ\t=\t0, text/html;q=0.5", false],
    ["text/markdown;q=0.5, text/html; q = 0", true],
  ])("B23 — trims quality parameter names and values in %s", (accept, expected) => {
    expect(wantsAnswerMarkdown(accept)).toBe(expected);
  });
});
