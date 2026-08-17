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
    expect((bucks?.items ?? []).length).toBe(6);
    expect(bucks?.currency).toBe("GBP");
    expect(bucks?.items?.[0]?.amount).toBe("2476.80");
    expect(bucks?.items?.[0]?.label.includes("2,476")).toBe(false);
    expect(bucks?.detail).toContain("mermaid");
    expect(bucks?.detail).toContain("https://www.buckinghamshire.gov.uk/");
    const hmrc = kerryPlayQuestionnaire.questions.find(
      (question) => question.id === "hmrc",
    );
    expect((hmrc?.fields ?? []).length).toBe(3);
    expect(hmrc?.currency).toBe("GBP");
    expect(hmrc?.fields?.[0]?.input).toBe("money");
    expect(hmrc?.detail).toContain("https://www.gov.uk");
  });
});
