import { describe, expect, it } from "vitest";
import { questionnaireMarkdown } from "./questionnaire-markdown";
import { questionSchema } from "./schema";

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
      answerUrl: "https://ask.imeatsack.com/s/1?t=pub",
      machineUrl: "https://ask.imeatsack.com/s/1.md?t=pub",
      answersUrl: "https://ask.imeatsack.com/api/v1/sessions/1/answers?t=pub",
      submitUrl: "https://ask.imeatsack.com/api/v1/sessions/1/submit?t=pub",
      filesUrl: "https://ask.imeatsack.com/api/v1/sessions/1/files?t=pub",
    });
    expect(markdown).toContain("PUT");
    expect(markdown).toContain("JSON Schema");
    expect(markdown).toContain("selectedOptionIds");
    expect(markdown).toContain("Because cake");
  });

  it("B23 — uses real answer shapes and exposes saved file ids without storage keys", () => {
    const markdown = questionnaireMarkdown({
      questions: [
        questionSchema.parse({
          id: "decision",
          prompt: "Which?",
          options: [
            { id: "go", label: "Go" },
            { id: "wait", label: "Wait" },
          ],
        }),
        questionSchema.parse({ id: "notes", prompt: "Anything else?", allowFiles: true }),
        questionSchema.parse({
          id: "details",
          prompt: "Details?",
          fields: [
            { id: "name", label: "Name", input: "text" },
            { id: "role", label: "Role", input: "text" },
          ],
        }),
      ],
      status: "submitted",
      expiresAt: "2026-10-13T12:00:00.000Z",
      answers: {
        notes: {
          selectedOptionIds: [],
          text: "Saved note",
          answeredAt: "2026-10-12T12:00:00.000Z",
          files: [
            {
              id: "file-1",
              questionId: "notes",
              filename: "notes.txt",
              contentType: "text/plain",
              size: 12,
              uploadedAt: "2026-10-12T12:00:00.000Z",
              key: "private-storage-key",
              url: "https://example.com/file",
            },
          ],
        },
      },
      answerUrl: "https://ask.imeatsack.com/s/1?t=pub",
      machineUrl: "https://ask.imeatsack.com/s/1.md?t=pub",
      answersUrl: "https://ask.imeatsack.com/api/v1/sessions/1/answers?t=pub",
      submitUrl: "https://ask.imeatsack.com/api/v1/sessions/1/submit?t=pub",
      filesUrl: "https://ask.imeatsack.com/api/v1/sessions/1/files?t=pub",
    });
    const payload = JSON.parse(markdown.match(/Payload shape[\s\S]*?```json\n([\s\S]*?)\n```/)![1]);
    expect(payload).toEqual({
      answers: {
        decision: { selectedOptionIds: ["go"] },
        notes: { text: "Your answer" },
        details: { entries: { name: "Your answer", role: "Your answer" } },
      },
      submit: true,
    });
    const saved = JSON.parse(
      markdown.match(/## Saved answers[\s\S]*?```json\n([\s\S]*?)\n```/)![1],
    );
    expect(saved.notes).toMatchObject({ text: "Saved note", fileIds: ["file-1"] });
    expect(markdown).toContain("Status: `submitted`");
    expect(markdown).toContain("2026-10-13T12:00:00.000Z");
    expect(markdown).toContain("This questionnaire is closed");
    expect(markdown).not.toContain("private-storage-key");
  });
});
