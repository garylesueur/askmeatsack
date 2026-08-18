import { z } from "zod";
import { callbackUrlIsUsable } from "./callback-url";
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
export const QUESTION_OPTIONS_MAX = 8;
export const TITLE_MAX_CHARS = 200;
export const CONTEXT_MAX_CHARS = 4_000;
export const PROMPT_MAX_CHARS = 1_000;
export const METADATA_KEYS_MAX = 20;
export const METADATA_KEY_MAX_CHARS = 200;
export const METADATA_VALUE_MAX_CHARS = 200;
export const QUESTION_OPTIONS_MIN = 2;
export const QUESTION_ITEMS_MIN = 2;
export const QUESTION_FIELDS_MIN = 2;

export type QuestionIssue = {
  questionId?: string;
  code: string;
  message: string;
};

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
  amount: z.string().min(1).max(40).optional(),
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

const QUESTION_ISSUE_MESSAGES: Record<string, string> = {
  questions_required: "Need at least one question",
  items_min: "Item questions need two to sixteen rows",
  items_max: "Item questions need two to sixteen rows",
  fields_min: "Field questions need two to eight fields",
  fields_max: "Field questions need two to eight fields",
  options_min: "Choice questions need two to eight options",
  options_max: "Choice questions need two to eight options",
  invalid_currency: "Currency must be a three-letter ISO 4217 code",
  comment_needs_shape: "allowComment is only valid on a choice, items, or fields question",
  mixed_shapes: "A question cannot mix options, items, and fields",
  money_needs_currency: "Money rows need a currency",
  amount_needs_currency: "An amount needs a currency",
  invalid_amount: "Amount is not a usable money value",
  recommended_unknown: "Recommended option must belong to the question",
  duplicate_question_id: "Question ids must be unique",
  duplicate_option_id: "Option ids must be unique on a question",
  duplicate_entry_id: "Entry ids must be unique on a question",
  choice_fields_on_text: "Text questions cannot have choice fields",
  choice_fields_on_entries: "Item and field questions cannot have choice fields",
};

export const questionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1).max(PROMPT_MAX_CHARS),
  detail: z.string().max(QUESTION_DETAIL_MAX_CHARS).optional(),
  options: z.array(questionOptionSchema).max(QUESTION_OPTIONS_MAX).optional().default([]),
  items: z.array(questionEntrySchema).min(QUESTION_ITEMS_MIN).max(QUESTION_ITEMS_MAX).optional(),
  fields: z.array(questionEntrySchema).min(QUESTION_FIELDS_MIN).max(QUESTION_FIELDS_MAX).optional(),
  allowMultiple: z.boolean().optional().default(false),
  required: z.boolean().optional().default(true),
  allowComment: z.boolean().optional().default(false),
  allowFiles: z.boolean().optional().default(false),
  recommendedOptionId: z.string().min(1).optional(),
  currency: isoCurrencySchema.optional(),
});

function addQuestionIssue(
  ctx: z.RefinementCtx,
  index: number,
  questionId: string,
  issueCode: string,
  message: string,
): void {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message,
    path: ["questions", index],
    params: { questionId, issueCode },
  });
}

function refineQuestionList(
  questions: z.infer<typeof questionSchema>[],
  ctx: z.RefinementCtx,
): void {
  const questionIds = new Set<string>();
  for (const [index, question] of questions.entries()) {
    if (questionIds.has(question.id)) {
      addQuestionIssue(
        ctx,
        index,
        question.id,
        "duplicate_question_id",
        QUESTION_ISSUE_MESSAGES.duplicate_question_id,
      );
    }
    questionIds.add(question.id);

    const options = question.options ?? [];
    const items = question.items ?? [];
    const fields = question.fields ?? [];
    const shaped =
      (options.length > 0 ? 1 : 0) + (items.length > 0 ? 1 : 0) + (fields.length > 0 ? 1 : 0);
    if (shaped > 1) {
      addQuestionIssue(
        ctx,
        index,
        question.id,
        "mixed_shapes",
        QUESTION_ISSUE_MESSAGES.mixed_shapes,
      );
    }

    if (options.length === 1) {
      addQuestionIssue(ctx, index, question.id, "options_min", QUESTION_ISSUE_MESSAGES.options_min);
    }

    if (options.length === 0 && items.length === 0 && fields.length === 0) {
      if (question.allowComment) {
        addQuestionIssue(
          ctx,
          index,
          question.id,
          "comment_needs_shape",
          QUESTION_ISSUE_MESSAGES.comment_needs_shape,
        );
      }
      if (question.allowMultiple) {
        addQuestionIssue(
          ctx,
          index,
          question.id,
          "choice_fields_on_text",
          QUESTION_ISSUE_MESSAGES.choice_fields_on_text,
        );
      }
      if (question.recommendedOptionId) {
        addQuestionIssue(
          ctx,
          index,
          question.id,
          "recommended_unknown",
          QUESTION_ISSUE_MESSAGES.recommended_unknown,
        );
      }
      continue;
    }

    if (items.length > 0 || fields.length > 0) {
      if (question.allowMultiple || question.recommendedOptionId) {
        addQuestionIssue(
          ctx,
          index,
          question.id,
          "choice_fields_on_entries",
          QUESTION_ISSUE_MESSAGES.choice_fields_on_entries,
        );
      }
      const rows = items.length > 0 ? items : fields;
      const rowIds = new Set<string>();
      for (const row of rows) {
        if (rowIds.has(row.id)) {
          addQuestionIssue(
            ctx,
            index,
            question.id,
            "duplicate_entry_id",
            QUESTION_ISSUE_MESSAGES.duplicate_entry_id,
          );
        }
        rowIds.add(row.id);
        const currency = row.currency ?? question.currency;
        if (row.input === "money" && !currency) {
          addQuestionIssue(
            ctx,
            index,
            question.id,
            "money_needs_currency",
            QUESTION_ISSUE_MESSAGES.money_needs_currency,
          );
        }
        if (row.amount) {
          if (!currency) {
            addQuestionIssue(
              ctx,
              index,
              question.id,
              "amount_needs_currency",
              QUESTION_ISSUE_MESSAGES.amount_needs_currency,
            );
          } else if (!parseMoney(row.amount, currency)) {
            addQuestionIssue(
              ctx,
              index,
              question.id,
              "invalid_amount",
              QUESTION_ISSUE_MESSAGES.invalid_amount,
            );
          }
        }
      }
      continue;
    }

    const optionIds = new Set<string>();
    for (const option of options) {
      if (optionIds.has(option.id)) {
        addQuestionIssue(
          ctx,
          index,
          question.id,
          "duplicate_option_id",
          QUESTION_ISSUE_MESSAGES.duplicate_option_id,
        );
      }
      optionIds.add(option.id);
    }

    if (question.recommendedOptionId && !optionIds.has(question.recommendedOptionId)) {
      addQuestionIssue(
        ctx,
        index,
        question.id,
        "recommended_unknown",
        QUESTION_ISSUE_MESSAGES.recommended_unknown,
      );
    }
  }
}

function questionIdFromInput(input: unknown, index: number): string | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const questions = (input as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) {
    return undefined;
  }
  const question = questions[index];
  if (!question || typeof question !== "object") {
    return undefined;
  }
  const id = (question as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function mappedIssueCode(issue: z.ZodIssue): string | undefined {
  const params = "params" in issue ? issue.params : undefined;
  if (
    params &&
    typeof params === "object" &&
    "issueCode" in params &&
    typeof params.issueCode === "string"
  ) {
    return params.issueCode;
  }
  const leaf = issue.path[issue.path.length - 1];
  if (
    issue.path.length === 1 &&
    issue.path[0] === "questions" &&
    issue.code === z.ZodIssueCode.too_small
  ) {
    return "questions_required";
  }
  if (leaf === "items" && issue.code === z.ZodIssueCode.too_small) {
    return "items_min";
  }
  if (leaf === "items" && issue.code === z.ZodIssueCode.too_big) {
    return "items_max";
  }
  if (leaf === "fields" && issue.code === z.ZodIssueCode.too_small) {
    return "fields_min";
  }
  if (leaf === "fields" && issue.code === z.ZodIssueCode.too_big) {
    return "fields_max";
  }
  if (leaf === "options" && issue.code === z.ZodIssueCode.too_small) {
    return "options_min";
  }
  if (leaf === "options" && issue.code === z.ZodIssueCode.too_big) {
    return "options_max";
  }
  if (leaf === "currency") {
    return "invalid_currency";
  }
  return undefined;
}

export function questionIssuesFromZod(error: z.ZodError, input?: unknown): QuestionIssue[] {
  const issues: QuestionIssue[] = [];
  const seen = new Set<string>();
  const sorted = [...error.issues].sort((left, right) => {
    const leftIndex = typeof left.path[1] === "number" ? left.path[1] : -1;
    const rightIndex = typeof right.path[1] === "number" ? right.path[1] : -1;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.path.length - right.path.length;
  });
  for (const issue of sorted) {
    if (issue.path[0] !== "questions") {
      continue;
    }
    const code = mappedIssueCode(issue);
    if (!code) {
      continue;
    }
    const index = typeof issue.path[1] === "number" ? issue.path[1] : undefined;
    const params = "params" in issue ? issue.params : undefined;
    const fromParams =
      params &&
      typeof params === "object" &&
      "questionId" in params &&
      typeof params.questionId === "string"
        ? params.questionId
        : undefined;
    const questionId =
      fromParams ?? (index !== undefined ? questionIdFromInput(input, index) : undefined);
    const message = QUESTION_ISSUE_MESSAGES[code] ?? issue.message;
    const key = `${questionId ?? ""}:${code}:${message}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const mapped: QuestionIssue = { code, message };
    if (questionId) {
      mapped.questionId = questionId;
    }
    issues.push(mapped);
  }
  return issues;
}

export function invalidQuestionsMessage(issues: QuestionIssue[]): string {
  const first = issues[0];
  if (!first) {
    return "Questions are not usable";
  }
  if (first.questionId) {
    return `Question ${first.questionId}: ${first.message}`;
  }
  return first.message;
}

const sessionFieldsSchema = z.object({
  title: z.string().min(1).max(TITLE_MAX_CHARS).optional(),
  context: z.string().max(CONTEXT_MAX_CHARS).optional(),
  expiresInSeconds: z.number().int().positive().max(SESSION_MAX_TTL_SECONDS).optional(),
  metadata: z
    .record(z.string().max(METADATA_KEY_MAX_CHARS), z.string().max(METADATA_VALUE_MAX_CHARS))
    .refine((value) => Object.keys(value).length <= METADATA_KEYS_MAX, {
      message: `Metadata holds at most ${METADATA_KEYS_MAX} keys`,
    })
    .optional(),
  callbackUrl: z
    .string()
    .url()
    .refine((value) => callbackUrlIsUsable(value).ok, {
      message: "callbackUrl must be a public https address, not a private or loopback one",
    })
    .optional(),
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
    entries: z.record(z.string().min(1), z.string().max(ENTRY_ANSWER_MAX_CHARS)).optional(),
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

export type BulkAnswersInput = z.infer<typeof bulkAnswersSchema>;
