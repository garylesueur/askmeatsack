import { ENTRY_ANSWER_MAX_CHARS } from "./schema";
import type { Question } from "./schema";
import { questionEntries, questionKind } from "./question-presentation";

export function answersJsonSchema(questions: Question[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const question of questions) {
    const kind = questionKind(question);
    const answerProperties: Record<string, unknown> = {};
    if (kind === "choice") {
      const optionIds = question.options.map((option) => option.id);
      answerProperties.selectedOptionIds = question.allowMultiple
        ? {
            type: "array",
            minItems: 1,
            items: { type: "string", enum: optionIds },
          }
        : {
            type: "array",
            minItems: 1,
            maxItems: 1,
            items: { type: "string", enum: optionIds },
          };
    }
    if (kind === "items" || kind === "fields") {
      const entryIds = questionEntries(question).map((row) => row.id);
      const entryProperties: Record<string, unknown> = {};
      for (const entryId of entryIds) {
        entryProperties[entryId] = {
          type: "string",
          maxLength: ENTRY_ANSWER_MAX_CHARS,
        };
      }
      answerProperties.entries = {
        type: "object",
        additionalProperties: false,
        properties: entryProperties,
      };
    }
    if (kind === "text" || question.allowComment) {
      answerProperties.text = { type: "string", maxLength: 2000 };
    }
    if (question.allowFiles) {
      answerProperties.fileIds = {
        type: "array",
        maxItems: 5,
        items: { type: "string" },
      };
    }
    properties[question.id] = {
      type: "object",
      additionalProperties: false,
      properties: answerProperties,
    };
    if (question.required) {
      required.push(question.id);
    }
  }
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    properties: {
      answers: {
        type: "object",
        additionalProperties: false,
        properties,
        required,
      },
      submit: { type: "boolean" },
    },
    required: ["answers"],
  };
}
