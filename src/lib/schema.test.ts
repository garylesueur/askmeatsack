import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSessionSchema, questionIssuesFromZod, questionSchema } from "./schema";

describe("question create validation", () => {
  it("requires at least two items and two fields in the schema", () => {
    const items = questionSchema.shape.items as z.ZodOptional<z.ZodArray<z.ZodTypeAny>>;
    const fields = questionSchema.shape.fields as z.ZodOptional<z.ZodArray<z.ZodTypeAny>>;
    expect(items._def.innerType._def.minLength?.value).toBe(2);
    expect(items._def.innerType._def.maxLength?.value).toBe(16);
    expect(fields._def.innerType._def.minLength?.value).toBe(2);
    expect(fields._def.innerType._def.maxLength?.value).toBe(8);
  });

  it("names the question and the rule for each distinct refusal", () => {
    const cases: Array<{
      name: string;
      question: Record<string, unknown>;
      code: string;
    }> = [
      {
        name: "comment on a shapeless question",
        question: {
          id: "villain",
          prompt: "Say more",
          allowComment: true,
        },
        code: "comment_needs_shape",
      },
      {
        name: "comment plus files still needs a shape",
        question: {
          id: "villain",
          prompt: "Photo and a note",
          allowComment: true,
          allowFiles: true,
        },
        code: "comment_needs_shape",
      },
      {
        name: "options mixed with items",
        question: {
          id: "mix",
          prompt: "Nope",
          options: [
            { id: "yes", label: "Yes" },
            { id: "no", label: "No" },
          ],
          items: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
        },
        code: "mixed_shapes",
      },
      {
        name: "options mixed with fields",
        question: {
          id: "mix",
          prompt: "Nope",
          options: [
            { id: "yes", label: "Yes" },
            { id: "no", label: "No" },
          ],
          fields: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
        },
        code: "mixed_shapes",
      },
      {
        name: "nine options",
        question: {
          id: "many",
          prompt: "Pick",
          options: Array.from({ length: 9 }, (_, index) => ({
            id: `o${index + 1}`,
            label: `Option ${index + 1}`,
          })),
        },
        code: "options_max",
      },
      {
        name: "one item",
        question: {
          id: "rows",
          prompt: "Label this",
          items: [{ id: "a", label: "A" }],
        },
        code: "items_min",
      },
      {
        name: "one field",
        question: {
          id: "boxes",
          prompt: "Fill this",
          fields: [{ id: "a", label: "A" }],
        },
        code: "fields_min",
      },
      {
        name: "money without currency",
        question: {
          id: "hmrc",
          prompt: "How much?",
          fields: [
            { id: "vat", label: "VAT", input: "money" },
            { id: "paye", label: "PAYE", input: "money" },
          ],
        },
        code: "money_needs_currency",
      },
      {
        name: "currency that is not three letters",
        question: {
          id: "hmrc",
          prompt: "How much?",
          currency: "GB",
          fields: [
            { id: "vat", label: "VAT", input: "money" },
            { id: "paye", label: "PAYE", input: "money" },
          ],
        },
        code: "invalid_currency",
      },
      {
        name: "recommended option that is not on the question",
        question: {
          id: "Q1",
          prompt: "Name?",
          options: [
            { id: "1", label: "A" },
            { id: "2", label: "B" },
          ],
          recommendedOptionId: "nope",
        },
        code: "recommended_unknown",
      },
    ];

    for (const testCase of cases) {
      const body = { questions: [testCase.question] };
      const parsed = createSessionSchema.safeParse(body);
      expect(parsed.success, testCase.name).toBe(false);
      if (parsed.success) {
        continue;
      }
      const issues = questionIssuesFromZod(parsed.error, body);
      expect(issues[0], testCase.name).toMatchObject({
        questionId: testCase.question.id,
        code: testCase.code,
      });
    }
  });

  it("refuses an empty question list with questions_required", () => {
    const body = { questions: [] };
    const parsed = createSessionSchema.safeParse(body);
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(questionIssuesFromZod(parsed.error, body)).toEqual([
      {
        code: "questions_required",
        message: "Need at least one question",
      },
    ]);
  });
});
