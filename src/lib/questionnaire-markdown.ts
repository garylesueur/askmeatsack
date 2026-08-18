import { answersJsonSchema } from "./answers-json-schema";
import { entryRowCaption } from "./money";
import { questionEntries, questionKind } from "./question-presentation";
import type { Question } from "./schema";

type MarkdownInput = {
  title?: string;
  context?: string;
  questions: Question[];
  answerUrl: string;
  machineUrl: string;
  answersUrl: string;
  submitUrl: string;
  filesUrl: string;
};

export function questionnaireMarkdown(input: MarkdownInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.title ?? "Questions"}`);
  if (input.context) {
    lines.push("", input.context);
  }
  lines.push(
    "",
    "This is the machine-readable form of an askmeatsack.com questionnaire.",
    "Humans use the browser page. Agents should read this file, POST JSON, then submit.",
    "",
    `- Browser: ${input.answerUrl}`,
    `- This document: ${input.machineUrl}`,
    `- Save answers: \`PUT ${input.answersUrl}\``,
    `- Submit: \`POST ${input.submitUrl}\``,
  );

  const needsFiles = input.questions.some((question) => question.allowFiles);
  if (needsFiles) {
    lines.push(
      `- Upload a file: \`POST ${input.filesUrl}\` as multipart field \`file\` with query \`questionId\`. Same public token. Then put the returned \`id\` in \`fileIds\`.`,
    );
  }

  lines.push("", "## Questions");
  for (const question of input.questions) {
    const flags: string[] = [];
    if (question.required) {
      flags.push("required");
    } else {
      flags.push("optional");
    }
    if (question.allowMultiple) {
      flags.push("several options");
    }
    if (question.allowComment) {
      flags.push("comment allowed");
    }
    if (question.allowFiles) {
      flags.push("files allowed");
    }
    lines.push("", `### ${question.id}`, "", question.prompt);
    if (question.detail) {
      lines.push("", question.detail);
    }
    lines.push("", `_${flags.join(", ")}_`);
    const kind = questionKind(question);
    if (kind === "text") {
      lines.push("", "Free text (max 2000 characters).");
    } else if (kind === "items" || kind === "fields") {
      lines.push("", kind === "items" ? "Rows:" : "Fields:");
      const rows = questionEntries(question);
      let hasMoney = false;
      for (const row of rows) {
        if (row.input === "money") {
          hasMoney = true;
        }
        lines.push(`- \`${row.id}\`: ${entryRowCaption(row, question)}`);
      }
      lines.push("", "Answer with `entries` keyed by those ids.");
      if (hasMoney) {
        lines.push("Money values are canonical decimals in that currency — do not convert.");
      }
    } else {
      lines.push("", "Options:");
      for (const option of question.options) {
        const recommended = question.recommendedOptionId === option.id ? " — recommended" : "";
        lines.push(`- \`${option.id}\`: ${option.label}${recommended}`);
      }
    }
  }

  lines.push(
    "",
    "## How to answer",
    "",
    "PUT a JSON body to the save URL. Set `submit` to true to freeze answers in the same request, or POST the submit URL after.",
    "",
    "```json",
    JSON.stringify(
      {
        answers: {
          Q1: { selectedOptionIds: ["yes"], text: "optional comment" },
        },
        submit: true,
      },
      null,
      2,
    ),
    "```",
    "",
    "## JSON Schema",
    "",
    "```json",
    JSON.stringify(answersJsonSchema(input.questions), null, 2),
    "```",
    "",
  );
  return lines.join("\n");
}
