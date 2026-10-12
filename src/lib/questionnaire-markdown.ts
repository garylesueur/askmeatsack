import { answersJsonSchema } from "./answers-json-schema";
import { entryRowCaption } from "./money";
import { questionEntries, questionKind } from "./question-presentation";
import type { Question, SessionStatus } from "./schema";
import type { SessionAnswer } from "./session-store";

type MarkdownInput = {
  title?: string;
  context?: string;
  questions: Question[];
  answerUrl: string;
  machineUrl: string;
  answersUrl: string;
  submitUrl: string;
  filesUrl: string;
  status?: SessionStatus;
  expiresAt?: string;
  answers?: Record<string, SessionAnswer>;
};

export function questionnaireMarkdown(input: MarkdownInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.title ?? "Questions"}`);
  if (input.context) {
    lines.push("", input.context);
  }
  lines.push(
    "",
    "This is the machine-readable form of an ask.imeatsack.com questionnaire.",
    "You can answer on the respondent's behalf without clicking through the browser form.",
    "For an open questionnaire, read every question, then PUT all answers as JSON with `submit: true` in one request.",
    "",
    `- Browser: ${input.answerUrl}`,
    `- This document: ${input.machineUrl}`,
    `- Save answers: \`PUT ${input.answersUrl}\``,
    `- Submit: \`POST ${input.submitUrl}\``,
  );

  if (input.status) {
    lines.push("", `Status: \`${input.status}\``);
    if (input.expiresAt) {
      lines.push(`Expires at: ${input.expiresAt}`);
    }
    if (["submitted", "expired", "cancelled"].includes(input.status)) {
      lines.push(
        "This questionnaire is closed. Answers cannot be changed; do not send new answers.",
      );
    }
  }

  const needsFiles = input.questions.some((question) => question.allowFiles || question.sketch);
  if (needsFiles) {
    lines.push(
      `- Upload a file: \`POST ${input.filesUrl}\` as multipart field \`file\` with query \`questionId\`. Same public token. Then put the returned \`id\` in \`fileIds\` (or \`previewFileId\` for a sketch snapshot).`,
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
    } else if (kind === "sketch") {
      lines.push(
        "",
        "Sketch. Draw with pen, line, rectangle, ellipse, arrow, or text. Answer with `sketch` (shapes on a 0–1 board). Upload a PNG snapshot of the board, then set `previewFileId`.",
      );
      if (question.backgroundFileId) {
        lines.push("This question has a background picture. The scene is only what they drew.");
      }
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
    "1. Use the questions and JSON Schema to prepare answers keyed by the exact question ids. Use option ids, not labels. Ask the respondent for anything you cannot answer from their available information; do not invent answers or select recommendations automatically.",
    "2. Send `PUT` to the save URL with `Content-Type: application/json` and a body containing `answers` and `submit: true`. Keep the `t` token from the link. No account, API key, MCP connection, or browser interaction is needed to answer.",
    '3. Confirm that the response contains `submitted.status: "submitted"`. Submission freezes the answers. If the response contains `error`, correct the named problem and retry while the questionnaire is open. Valid answers may already have been saved before an error; fetch this document again to check.',
    "",
    "To save a draft instead, omit `submit` or set it to false. You can later POST the submit URL to finish without resending answers. Every required question must have a usable answer before submission; optional questions may be omitted.",
    "",
    "Payload shape for this questionnaire (replace the example values with the respondent's answers; these are not suggested answers):",
    "",
    "```json",
    JSON.stringify(
      {
        answers: Object.fromEntries(
          input.questions.map((question) => {
            const kind = questionKind(question);
            const answer: Record<string, unknown> = {};
            if (kind === "choice") {
              answer.selectedOptionIds = [question.options[0].id];
            } else if (kind === "sketch") {
              answer.sketch = {
                shapes: [
                  { id: "example", type: "rectangle", x: 0.1, y: 0.1, width: 0.6, height: 0.4 },
                ],
              };
            } else if (kind === "items" || kind === "fields") {
              answer.entries = Object.fromEntries(
                questionEntries(question).map((row) => [
                  row.id,
                  row.input === "money" ? "0.00" : "Your answer",
                ]),
              );
            } else {
              answer.text = "Your answer";
            }
            if (question.allowComment) answer.text = "Your comment";
            return [question.id, answer];
          }),
        ),
        submit: true,
      },
      null,
      2,
    ),
    "```",
    "",
    "## Saved answers",
    "",
    "These are the current answers, not a request body. Preserve answers the respondent still wants, and use uploaded file ids in `fileIds` when answering questions with files.",
    "",
    "```json",
    JSON.stringify(
      Object.fromEntries(
        Object.entries(input.answers ?? {}).map(([id, answer]) => [
          id,
          {
            selectedOptionIds: answer.selectedOptionIds,
            ...(answer.text !== undefined ? { text: answer.text } : {}),
            ...(answer.entries ? { entries: answer.entries } : {}),
            ...(answer.sketch ? { sketch: answer.sketch } : {}),
            ...(answer.previewFileId ? { previewFileId: answer.previewFileId } : {}),
            ...(answer.files?.length ? { fileIds: answer.files.map((file) => file.id) } : {}),
          },
        ]),
      ),
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
