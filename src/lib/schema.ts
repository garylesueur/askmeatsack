import { z } from "zod";
import { isIsoCurrency, parseMoney } from "./money";

export const SESSION_DEFAULT_TTL_SECONDS = 86_400;
export const SESSION_MAX_TTL_SECONDS = 7 * 86_400;
export const SESSION_READ_WINDOW_SECONDS = 3_600;
export const TEXT_ANSWER_MAX_CHARS = 2_000;
export const ENTRY_ANSWER_MAX_CHARS = 200;
export const QUESTION_DETAIL_MAX_CHARS = 8_000;
export const QUESTION_ITEMS_MAX = 16;
export const QUESTION_FIELDS_MAX = 8;
export const WAIT_MAX_SECONDS = 60;
export const FILE_MAX_BYTES = 4 * 1024 * 1024;
export const FILE_MAX_COUNT = 5;

export const questionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const isoCurrencySchema = z
  .string()
  .length(3)
  .refine((code) => isIsoCurrency(code), "Currency must be a three-letter ISO code");

export const questionEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  hint: z.string().min(1).max(200).optional(),
  input: z.enum(["text", "money"]).optional(),
  currency: isoCurrencySchema.optional(),
  amount: z
    .string()
    .min(1)
    .max(40)
    .optional(),
});

export const appearanceThemeSchema = z.enum(["ask", "paper", "grove", "ember"]);

export const appearanceSchema = z.object({
  theme: appearanceThemeSchema.optional(),
  mode: z.enum(["dark", "light"]).optional(),
  accent: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Accent must be a six-digit hex colour")
    .optional(),
});

export type Appearance = z.infer<typeof appearanceSchema>;

export const questionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  detail: z.string().max(QUESTION_DETAIL_MAX_CHARS).optional(),
  options: z.array(questionOptionSchema).max(8).optional().default([]),
  items: z.array(questionEntrySchema).max(QUESTION_ITEMS_MAX).optional().default([]),
  fields: z
    .array(questionEntrySchema)
    .max(QUESTION_FIELDS_MAX)
    .optional()
    .default([]),
  allowMultiple: z.boolean().optional().default(false),
  required: z.boolean().optional().default(true),
  allowComment: z.boolean().optional().default(false),
  allowFiles: z.boolean().optional().default(false),
  recommendedOptionId: z.string().min(1).optional(),
  currency: isoCurrencySchema.optional(),
});

function refineQuestionList(
  questions: z.infer<typeof questionSchema>[],
  ctx: z.RefinementCtx,
): void {
  const questionIds = new Set<string>();
  for (const question of questions) {
    if (questionIds.has(question.id)) {
      ctx.addIssue({
        code: "custom",
        message: "Question ids must be unique",
        path: ["questions"],
      });
      return;
    }
    questionIds.add(question.id);

    const shaped =
      (question.options.length > 0 ? 1 : 0) +
      (question.items.length > 0 ? 1 : 0) +
      (question.fields.length > 0 ? 1 : 0);
    if (shaped > 1) {
      ctx.addIssue({
        code: "custom",
        message: "A question cannot mix options, items, and fields",
        path: ["questions"],
      });
      return;
    }

    if (question.items.length === 1) {
      ctx.addIssue({
        code: "custom",
        message: "Item questions need two to sixteen rows",
        path: ["questions"],
      });
      return;
    }

    if (question.fields.length === 1) {
      ctx.addIssue({
        code: "custom",
        message: "Field questions need two to eight fields",
        path: ["questions"],
      });
      return;
    }

    if (question.options.length === 1) {
      ctx.addIssue({
        code: "custom",
        message: "Choice questions need two to eight options",
        path: ["questions"],
      });
      return;
    }

    if (question.options.length === 0 && question.items.length === 0 && question.fields.length === 0) {
      if (
        question.allowComment ||
        question.allowMultiple ||
        question.recommendedOptionId
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Text questions cannot have choice fields",
          path: ["questions"],
        });
        return;
      }
      continue;
    }

    if (question.items.length > 0 || question.fields.length > 0) {
      if (question.allowMultiple || question.recommendedOptionId) {
        ctx.addIssue({
          code: "custom",
          message: "Item and field questions cannot have choice fields",
          path: ["questions"],
        });
        return;
      }
      const rows = question.items.length > 0 ? question.items : question.fields;
      const rowIds = new Set<string>();
      for (const row of rows) {
        if (rowIds.has(row.id)) {
          ctx.addIssue({
            code: "custom",
            message: "Entry ids must be unique on a question",
            path: ["questions"],
          });
          return;
        }
        rowIds.add(row.id);
        const currency = row.currency ?? question.currency;
        if (row.input === "money" && !currency) {
          ctx.addIssue({
            code: "custom",
            message: "Money rows need a currency",
            path: ["questions"],
          });
          return;
        }
        if (row.amount) {
          if (!currency) {
            ctx.addIssue({
              code: "custom",
              message: "An amount needs a currency",
              path: ["questions"],
            });
            return;
          }
          if (!parseMoney(row.amount, currency)) {
            ctx.addIssue({
              code: "custom",
              message: "Amount is not a usable money value",
              path: ["questions"],
            });
            return;
          }
        }
      }
      continue;
    }

    const optionIds = new Set<string>();
    for (const option of question.options) {
      if (optionIds.has(option.id)) {
        ctx.addIssue({
          code: "custom",
          message: "Option ids must be unique on a question",
          path: ["questions"],
        });
        return;
      }
      optionIds.add(option.id);
    }

    if (
      question.recommendedOptionId &&
      !optionIds.has(question.recommendedOptionId)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Recommended option must belong to the question",
        path: ["questions"],
      });
      return;
    }
  }
}

const sessionFieldsSchema = z.object({
  title: z.string().min(1).optional(),
  context: z.string().optional(),
  expiresInSeconds: z
    .number()
    .int()
    .positive()
    .max(SESSION_MAX_TTL_SECONDS)
    .optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  callbackUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  appearance: appearanceSchema.optional(),
});

export const createSessionSchema = sessionFieldsSchema
  .extend({
    questions: z.array(questionSchema).min(1),
  })
  .superRefine((value, ctx) => {
    refineQuestionList(value.questions, ctx);
  });

export const editSessionSchema = sessionFieldsSchema
  .extend({
    questions: z.array(questionSchema).min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.title === undefined &&
      value.context === undefined &&
      value.expiresInSeconds === undefined &&
      value.metadata === undefined &&
      value.callbackUrl === undefined &&
      value.email === undefined &&
      value.appearance === undefined &&
      value.questions === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Nothing to update",
      });
      return;
    }
    if (value.questions) {
      refineQuestionList(value.questions, ctx);
    }
  });

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type EditSessionInput = z.infer<typeof editSessionSchema>;
export type Question = z.infer<typeof questionSchema>;
export type ChoiceQuestion = Question;

export const sessionStatusSchema = z.enum([
  "pending",
  "in_progress",
  "submitted",
  "expired",
  "cancelled",
]);

export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const saveAnswerSchema = z
  .object({
    selectedOptionIds: z.array(z.string().min(1)).min(1).optional(),
    text: z.string().max(TEXT_ANSWER_MAX_CHARS).optional(),
    fileIds: z.array(z.string().min(1)).max(FILE_MAX_COUNT).optional(),
    entries: z
      .record(z.string().min(1), z.string().max(ENTRY_ANSWER_MAX_CHARS))
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.selectedOptionIds === undefined &&
      value.text === undefined &&
      value.fileIds === undefined &&
      value.entries === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Answer is not usable",
      });
    }
  });

export const bulkAnswersSchema = z.object({
  answers: z.record(z.string(), saveAnswerSchema),
  submit: z.boolean().optional(),
});

export const waitSchema = z.object({
  seconds: z.number().int().positive().max(WAIT_MAX_SECONDS),
});

export const sendEmailSchema = z.object({
  email: z.string().email().optional(),
});

export type BulkAnswersInput = z.infer<typeof bulkAnswersSchema>;
