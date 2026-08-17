import { describe, expect, it } from "vitest";
import {
  entriesAreComplete,
  isShortPrompt,
  questionHasEvidence,
  questionKind,
} from "./question-presentation";

describe("isShortPrompt", () => {
  it("treats a one-line ask as a heading", () => {
    expect(isShortPrompt("Which invoices clear in the next 14 days?")).toBe(
      true,
    );
  });

  it("does not treat a jammed brief as a heading", () => {
    expect(
      isShortPrompt(
        "Please label these Bucks / buckinghamshire.gov lines: Feb/Mar 2025 2476.80 and 2477.00 (DD and card each month), Dec 2025 840, Jan 2026 660, and credits 18 Feb 2026 81 and 588.",
      ),
    ).toBe(false);
  });

  it("does not treat markdown blocks as a heading", () => {
    expect(isShortPrompt("## Payroll\nIs Rebecca on this run?")).toBe(false);
    expect(isShortPrompt("- one\n- two")).toBe(false);
  });
});

describe("questionKind", () => {
  it("treats items and fields as their own kinds", () => {
    expect(
      questionKind({
        options: [],
        items: [{ id: "a" }, { id: "b" }],
      }),
    ).toBe("items");
    expect(
      questionKind({
        options: [],
        fields: [{ id: "vat" }, { id: "paye" }],
      }),
    ).toBe("fields");
  });

  it("needs every row filled", () => {
    const question = {
      options: [] as { id: string }[],
      items: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    };
    expect(entriesAreComplete(question, { a: "rent" })).toBe(false);
    expect(entriesAreComplete(question, { a: "rent", b: "card" })).toBe(true);
  });
});

describe("questionHasEvidence", () => {
  it("is true only when detail has text", () => {
    expect(questionHasEvidence({ detail: "A table of lines" })).toBe(true);
    expect(questionHasEvidence({ detail: "   " })).toBe(false);
    expect(questionHasEvidence({})).toBe(false);
  });
});
