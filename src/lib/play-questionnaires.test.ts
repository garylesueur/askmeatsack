import { describe, expect, it } from "vitest";
import { kerryPlayQuestionnaire } from "./play-questionnaires";

describe("kerry playground pack", () => {
  it("keeps prompts short and puts the brief in detail", () => {
    expect(kerryPlayQuestionnaire.questions.length).toBe(11);
    for (const question of kerryPlayQuestionnaire.questions) {
      expect(question.prompt.includes("\n")).toBe(false);
      expect(question.prompt.length).toBeLessThanOrEqual(90);
      expect(question.detail && question.detail.length > 0).toBe(true);
    }
    const bucks = kerryPlayQuestionnaire.questions.find(
      (question) => question.id === "bucks",
    );
    expect(bucks?.items.length).toBe(6);
    expect(bucks?.detail).toContain("mermaid");
    const hmrc = kerryPlayQuestionnaire.questions.find(
      (question) => question.id === "hmrc",
    );
    expect(hmrc?.fields.length).toBe(3);
  });
});
