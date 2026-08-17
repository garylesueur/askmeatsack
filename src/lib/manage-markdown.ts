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

function questionKind(question: Question): string {
  if (question.options.length === 0) {
    return "text";
  }
  if (question.allowMultiple) {
    return "several options";
  }
  return "choice";
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
      "Nobody has answered yet. You can still change title, context, questions, appearance, expiry, or email with action `edit` or `PATCH` this session.",
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
    const flags: string[] = [questionKind(question)];
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
        const recommended =
          question.recommendedOptionId === option.id ? " — recommended" : "";
        lines.push(`- \`${option.id}\`: ${option.label}${recommended}`);
      }
    }
    if (answer) {
      const bits: string[] = [];
      if (answer.selectedOptionIds.length > 0) {
        bits.push(`options ${answer.selectedOptionIds.join(", ")}`);
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
