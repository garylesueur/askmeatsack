import { describe, expect, it } from "vitest";
import { answersDownloadMarkdown, wantsMarkdownDownload } from "./answers-download";
import type { Question } from "./schema";

const questions: Question[] = [
  {
    id: "Q1",
    prompt: "What should we call this?",
    options: [
      { id: "1", label: "askmeatsack.com" },
      { id: "2", label: "Something else" },
    ],
    allowMultiple: false,
    required: true,
    allowComment: false,
    allowFiles: false,
  },
  {
    id: "Q2",
    prompt: "Leftovers",
    options: [],
    items: [
      { id: "rent", label: "Rent", input: "money", currency: "GBP" },
      { id: "note", label: "Note" },
    ],
    allowMultiple: false,
    required: true,
    allowComment: false,
    allowFiles: false,
  },
];

const download = {
  sessionId: "session-1",
  title: "Naming",
  status: "submitted" as const,
  answers: [
    {
      questionId: "Q1",
      prompt: "What should we call this?",
      selectedOptionIds: ["1"],
      selectedLabels: ["askmeatsack.com"],
    },
    {
      questionId: "Q2",
      prompt: "Leftovers",
      selectedOptionIds: [],
      selectedLabels: [],
      entries: { rent: "6500", note: "Paid" },
    },
  ],
};

describe("answersDownloadMarkdown", () => {
  it("writes a readable copy with labels and money", () => {
    const markdown = answersDownloadMarkdown(download, questions);
    expect(markdown).toContain("# Naming");
    expect(markdown).toContain("Your answers from askmeatsack.com");
    expect(markdown).toContain("## What should we call this?");
    expect(markdown).toContain("- askmeatsack.com");
    expect(markdown).toContain("- Rent: £6,500.00");
    expect(markdown).toContain("- Note: Paid");
    expect(markdown).not.toContain("agent-secret");
  });
});

describe("wantsMarkdownDownload", () => {
  it("is true for format=md", () => {
    expect(
      wantsMarkdownDownload(
        new Request("https://askmeatsack.com/api/v1/sessions/s/download?format=md"),
      ),
    ).toBe(true);
  });

  it("is false for the ordinary JSON download", () => {
    expect(
      wantsMarkdownDownload(
        new Request("https://askmeatsack.com/api/v1/sessions/s/download?t=public"),
      ),
    ).toBe(false);
  });
});
