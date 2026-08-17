import { formatEntryValue } from "./money";
import { questionEntries } from "./question-presentation";
import type { Question } from "./schema";

export type AnswersCopyInput = {
  title?: string;
  answers: Array<{
    questionId: string;
    prompt: string;
    selectedLabels: string[];
    text?: string;
    entries?: Record<string, string>;
    files?: { filename: string }[];
  }>;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function answerLines(
  download: AnswersCopyInput,
  questions: Question[],
): string[] {
  const lines: string[] = [];
  for (const row of download.answers) {
    let question: Question | undefined;
    for (const candidate of questions) {
      if (candidate.id === row.questionId) {
        question = candidate;
        break;
      }
    }
    lines.push(row.prompt);
    if (row.selectedLabels.length > 0) {
      lines.push(row.selectedLabels.join(", "));
    }
    if (row.entries && question) {
      for (const entry of questionEntries(question)) {
        const value = row.entries[entry.id];
        if (value) {
          lines.push(`${entry.label}: ${formatEntryValue(entry, question, value)}`);
        }
      }
    } else if (row.entries) {
      for (const [entryId, value] of Object.entries(row.entries)) {
        if (value) {
          lines.push(`${entryId}: ${value}`);
        }
      }
    }
    if (row.text) {
      lines.push(row.text);
    }
    if (row.files && row.files.length > 0) {
      const names: string[] = [];
      for (const file of row.files) {
        names.push(file.filename);
      }
      lines.push(names.join(", "));
    }
    lines.push("");
  }
  return lines;
}

export function answersCopyText(
  download: AnswersCopyInput,
  questions: Question[],
): string {
  const title = download.title?.trim() || "Questionnaire";
  const bits = [
    title,
    "Your answers from askmeatsack.com",
    "",
    ...answerLines(download, questions),
    "A JSON copy is attached.",
    "",
  ];
  return bits.join("\n");
}

export function answersCopyHtml(
  download: AnswersCopyInput,
  questions: Question[],
): string {
  const title = escapeHtml(download.title?.trim() || "Questionnaire");
  const blocks: string[] = [
    `<p><strong>${title}</strong></p>`,
    "<p>Your answers from askmeatsack.com</p>",
  ];
  const lines = answerLines(download, questions);
  let current: string[] = [];
  const flush = () => {
    if (current.length === 0) {
      return;
    }
    const [prompt, ...rest] = current;
    blocks.push(`<p><strong>${escapeHtml(prompt ?? "")}</strong><br>${rest.map(escapeHtml).join("<br>")}</p>`);
    current = [];
  };
  for (const line of lines) {
    if (line === "") {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  blocks.push("<p>A JSON copy is attached.</p>");
  return blocks.join("");
}
