import { describe, expect, it } from "vitest";
import { answersCopyText, type AnswersCopyInput } from "./answers-copy";
import type { Question } from "./schema";

describe("answers copy", () => {
  it("writes a readable copy with formatted money and no secrets", () => {
    const questions: Question[] = [
      {
        id: "hmrc",
        prompt: "How much is still owed?",
        options: [],
        items: [],
        fields: [
          { id: "vat", label: "VAT", input: "money" },
          { id: "paye", label: "PAYE", input: "money" },
        ],
        allowMultiple: false,
        required: true,
        allowComment: false,
        allowFiles: false,
        currency: "GBP",
      },
    ];
    const download: AnswersCopyInput = {
      title: "Leftovers",
      answers: [
        {
          questionId: "hmrc",
          prompt: "How much is still owed?",
          selectedLabels: [],
          entries: { vat: "1200.50", paye: "80.00" },
        },
      ],
    };
    const text = answersCopyText(download, questions);
    expect(text).toContain("Leftovers");
    expect(text).toContain("VAT: £1,200.50");
    expect(text).toContain("PAYE: £80.00");
    expect(text).not.toContain("agent-token");
    expect(text).not.toContain("manageUrl");
  });
});
