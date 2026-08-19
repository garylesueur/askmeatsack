import { entryRowCaption, formatEntryValue } from "./money";
import { questionEntries, questionKind } from "./question-presentation";
import type { Question } from "./schema";
import type { Session, SessionAnswer } from "./session-store";

type ManageMarkdownInput = {
  title?: string;
  context?: string;
  status: Session["status"];
  expiresAt: string;
  openedAt: string | null;
  questions: Question[];
  answers: Record<string, SessionAnswer>;
  progress: { answeredCount: number; totalCount: number };
  answerUrl: string;
  machineUrl: string;
  manageUrl: string;
  canEdit: boolean;
};

function manageQuestionKind(question: Question): string {
  const kind = questionKind(question);
  if (kind === "choice" && question.allowMultiple) {
    return "several options";
  }
  return kind;
}

export function manageMarkdown(input: ManageMarkdownInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.title ?? "Questionnaire"}`);
  lines.push(
    "",
    "Private owner summary for askmeatsack.com. Do not give this link to the person answering.",
    "",
    `- Status: \`${input.status}\``,
    `- Expires: ${input.expiresAt}`,
    `- Opened: ${input.openedAt ?? "not yet"}`,
    `- Progress: ${input.progress.answeredCount} of ${input.progress.totalCount} answered`,
    `- Share with the human: ${input.answerUrl}`,
    `- Machine answering: ${input.machineUrl}`,
    `- This summary: ${input.manageUrl}`,
  );
  if (input.canEdit) {
    lines.push(
      "",
      "Nobody has answered yet. You can still change title, context, questions, appearance, or expiry with action `edit` or `PATCH` this session.",
    );
  } else {
    lines.push(
      "",
      "Questions are frozen. An answer has been saved, or the questionnaire is finished.",
    );
  }
  if (input.context) {
    lines.push("", "## Context", "", input.context);
  }
  lines.push("", "## Questions");
  for (const question of input.questions) {
    const flags: string[] = [manageQuestionKind(question)];
    flags.push(question.required ? "required" : "optional");
    if (question.allowComment) {
      flags.push("comment");
    }
    if (question.allowFiles) {
      flags.push("files");
    }
    const answer = input.answers[question.id];
    lines.push("", `### ${question.id}`, "", question.prompt);
    if (question.detail) {
      lines.push("", question.detail);
    }
    lines.push("", `_${flags.join(", ")}_`);
    if (question.options.length > 0) {
      lines.push("", "Options:");
      for (const option of question.options) {
        const recommended = question.recommendedOptionId === option.id ? " — recommended" : "";
        lines.push(`- \`${option.id}\`: ${option.label}${recommended}`);
      }
    }
    const rows = questionEntries(question);
    if (rows.length > 0) {
      lines.push("", manageQuestionKind(question) === "items" ? "Rows:" : "Fields:");
      for (const row of rows) {
        lines.push(`- \`${row.id}\`: ${entryRowCaption(row, question)}`);
      }
    }
    if (answer) {
      const bits: string[] = [];
      if (answer.selectedOptionIds.length > 0) {
        bits.push(`options ${answer.selectedOptionIds.join(", ")}`);
      }
      if (answer.entries) {
        const labelled: string[] = [];
        for (const row of rows) {
          const value = answer.entries[row.id];
          if (value) {
            labelled.push(`${row.label}: ${formatEntryValue(row, question, value)}`);
          }
        }
        if (labelled.length > 0) {
          bits.push(labelled.join("; "));
        }
      }
      if (answer.text) {
        bits.push(`text “${answer.text}”`);
      }
      if (answer.files && answer.files.length > 0) {
        bits.push(`${answer.files.length} file(s)`);
      }
      lines.push("", `Answered: ${bits.join("; ")}.`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
