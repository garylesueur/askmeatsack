import { formatEntryValue } from "./money";
import { questionEntries } from "./question-presentation";
import type { Question } from "./schema";
import type { SessionFile } from "./session-store";

export type AnswersDownload = {
  title?: string;
  answers: Array<{
    questionId: string;
    prompt: string;
    selectedLabels: string[];
    text?: string;
    entries?: Record<string, string>;
    files?: SessionFile[];
  }>;
};

function questionFor(
  questions: Question[],
  questionId: string,
): Question | undefined {
  for (const question of questions) {
    if (question.id === questionId) {
      return question;
    }
  }
  return undefined;
}

export function answersDownloadMarkdown(
  download: AnswersDownload,
  questions: Question[],
): string {
  const title = download.title?.trim() || "Questionnaire";
  const lines: string[] = [
    `# ${title}`,
    "",
    "Your answers from askmeatsack.com",
    "",
  ];

  for (const row of download.answers) {
    lines.push(`## ${row.prompt}`);
    lines.push("");
    const question = questionFor(questions, row.questionId);
    let wrote = false;

    if (row.selectedLabels.length > 0) {
      for (const label of row.selectedLabels) {
        lines.push(`- ${label}`);
      }
      wrote = true;
    }

    if (row.entries) {
      if (question) {
        for (const entry of questionEntries(question)) {
          const value = row.entries[entry.id];
          if (value) {
            lines.push(
              `- ${entry.label}: ${formatEntryValue(entry, question, value)}`,
            );
            wrote = true;
          }
        }
      } else {
        for (const [entryId, value] of Object.entries(row.entries)) {
          if (value) {
            lines.push(`- ${entryId}: ${value}`);
            wrote = true;
          }
        }
      }
    }

    if (row.text) {
      if (wrote) {
        lines.push("");
      }
      lines.push(row.text);
      wrote = true;
    }

    if (row.files && row.files.length > 0) {
      if (wrote) {
        lines.push("");
      }
      for (const file of row.files) {
        lines.push(`- [${file.filename}](${file.url})`);
      }
      wrote = true;
    }

    if (!wrote) {
      lines.push("_No answer._");
    }

    lines.push("");
  }

  return lines.join("\n");
}

export function wantsMarkdownDownload(request: Request): boolean {
  const format = new URL(request.url).searchParams.get("format");
  if (format === "md" || format === "markdown") {
    return true;
  }
  const accept = request.headers.get("accept") ?? "";
  return /\btext\/markdown\b/i.test(accept);
}
