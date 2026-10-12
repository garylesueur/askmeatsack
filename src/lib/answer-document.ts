export function machineQuestionnairePath(sessionId: string, publicToken?: string): string {
  const path = `/s/${sessionId}.md`;
  if (!publicToken) {
    return path;
  }
  return `${path}?t=${encodeURIComponent(publicToken)}`;
}

export function wantsAnswerMarkdown(accept: string | null): boolean {
  const qualities = new Map<string, number>();
  for (const range of (accept ?? "").split(",")) {
    const [type, ...parameters] = range.trim().toLowerCase().split(";");
    const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
    if (Number.isFinite(quality) && quality >= 0 && quality <= 1) {
      qualities.set(type.trim(), quality);
    }
  }
  const markdown = Math.max(qualities.get("text/markdown") ?? 0, qualities.get("text/plain") ?? 0);
  // Prefer HTML on a tie; missing/wildcard Accept keeps the browser page.
  return markdown > 0 && markdown > (qualities.get("text/html") ?? 0);
}
