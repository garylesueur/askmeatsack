import { parseMoney, resolveEntryCurrency } from "./money";
import type { Question } from "./schema";

const SHORT_PROMPT_MAX_CHARS = 90;

export type QuestionKind = "choice" | "text" | "items" | "fields";

export function questionKind(question: {
  options: { id: string }[];
  items?: { id: string }[];
  fields?: { id: string }[];
}): QuestionKind {
  if ((question.items ?? []).length > 0) {
    return "items";
  }
  if ((question.fields ?? []).length > 0) {
    return "fields";
  }
  if (question.options.length > 0) {
    return "choice";
  }
  return "text";
}

export function questionEntries(question: {
  items?: Question["items"];
  fields?: Question["fields"];
  options: { id: string }[];
}): NonNullable<Question["items"]> {
  if (questionKind(question) === "items") {
    return question.items ?? [];
  }
  if (questionKind(question) === "fields") {
    return question.fields ?? [];
  }
  return [];
}

export function entriesAreComplete(
  question: {
    items?: Question["items"];
    fields?: Question["fields"];
    options: { id: string }[];
    currency?: string;
  },
  entries: Record<string, string> | undefined,
): boolean {
  const rows = questionEntries(question);
  if (rows.length === 0) {
    return false;
  }
  for (const row of rows) {
    const raw = (entries?.[row.id] ?? "").trim();
    if (row.input === "money") {
      const currency = resolveEntryCurrency(row, question);
      if (!currency || !parseMoney(raw, currency)) {
        return false;
      }
      continue;
    }
    if (!raw) {
      return false;
    }
  }
  return true;
}

export function isShortPrompt(prompt: string): boolean {
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (trimmed.includes("\n")) {
    return false;
  }
  if (/^(#{1,6}\s|```|>\s|\s*[-*+]\s|\s*\d+\.\s|\|)/.test(trimmed)) {
    return false;
  }
  return trimmed.length <= SHORT_PROMPT_MAX_CHARS;
}

export function questionHasEvidence(question: { detail?: string }): boolean {
  return Boolean(question.detail?.trim());
}
