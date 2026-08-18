export function machineQuestionnairePath(sessionId: string, publicToken?: string): string {
  const path = `/s/${sessionId}.md`;
  if (!publicToken) {
    return path;
  }
  return `${path}?t=${encodeURIComponent(publicToken)}`;
}

export function wantsAnswerMarkdown(accept: string | null): boolean {
  const value = accept ?? "";
  if (/\btext\/html\b/i.test(value)) {
    return false;
  }
  return /\btext\/markdown\b/i.test(value) || /\btext\/plain\b/i.test(value);
}
