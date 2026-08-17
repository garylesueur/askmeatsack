const SHORT_PROMPT_MAX_CHARS = 90;

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
