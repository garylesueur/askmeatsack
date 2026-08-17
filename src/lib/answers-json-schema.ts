import type { Question } from "./schema";

export function answersJsonSchema(questions: Question[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const question of questions) {
    const answerProperties: Record<string, unknown> = {};
    if (question.options.length > 0) {
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
    if (question.options.length === 0 || question.allowComment) {
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
