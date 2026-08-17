import { describe, expect, it } from "vitest";
import { questionnaireMarkdown } from "./questionnaire-markdown";

describe("questionnaire markdown", () => {
  it("includes schema and submit instructions", () => {
    const markdown = questionnaireMarkdown({
      title: "Check",
      questions: [
        {
          id: "Q1",
          prompt: "Ship it?",
          detail: "Because cake",
          options: [
            { id: "yes", label: "Yes" },
            { id: "no", label: "Not yet" },
          ],
          allowMultiple: false,
          required: true,
          allowComment: false,
          allowFiles: false,
          items: [],
          fields: [],
        },
      ],
      answerUrl: "https://askmeatsack.com/s/1?t=pub",
      machineUrl: "https://askmeatsack.com/s/1.md?t=pub",
      answersUrl: "https://askmeatsack.com/api/v1/sessions/1/answers?t=pub",
      submitUrl: "https://askmeatsack.com/api/v1/sessions/1/submit?t=pub",
      filesUrl: "https://askmeatsack.com/api/v1/sessions/1/files?t=pub",
    });
    expect(markdown).toContain("PUT");
    expect(markdown).toContain("JSON Schema");
    expect(markdown).toContain("selectedOptionIds");
    expect(markdown).toContain("Because cake");
  });
});
