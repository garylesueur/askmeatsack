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
    const qualityParameter = parameters
      .map((parameter) => parameter.split("="))
      .find(([name, value]) => name.trim() === "q" && value !== undefined);
    const quality = qualityParameter ? Number(qualityParameter.slice(1).join("=").trim()) : 1;
    if (Number.isFinite(quality) && quality >= 0 && quality <= 1) {
      qualities.set(type.trim(), quality);
    }
  }
  const markdown = Math.max(qualities.get("text/markdown") ?? 0, qualities.get("text/plain") ?? 0);
  // Prefer HTML on a tie; missing/wildcard Accept keeps the browser page.
  return markdown > 0 && markdown > (qualities.get("text/html") ?? 0);
}
