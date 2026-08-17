import { describe, expect, it } from "vitest";
import {
  machineQuestionnairePath,
  wantsAnswerMarkdown,
} from "./answer-document";

describe("answer document negotiation", () => {
  it("does not treat a browser Accept as markdown", () => {
    expect(
      wantsAnswerMarkdown(
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ),
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
});
