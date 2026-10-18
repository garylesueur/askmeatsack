/** Portable, uncached account verification for private product operations. */
export type AccountAuthority =
  | { outcome: "anonymous" }
  | { outcome: "accepted"; account: string }
  | { outcome: "refused" };

export function createAccountAuthority(options: {
  lanyardUrl: string;
  product: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}) {
  const request = options.fetch ?? globalThis.fetch;
  return async (authorization: string | null): Promise<AccountAuthority> => {
    if (authorization === null) return { outcome: "anonymous" };
    if (authorization.length > 8192) return { outcome: "refused" };
    const match = /^Bearer +([A-Za-z0-9\-._~+/]+=*)$/i.exec(authorization);
    if (!match) return { outcome: "refused" };
    try {
      const response = await request(`${options.lanyardUrl.replace(/\/$/, "")}/api/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: match[1], product: options.product }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
      });
      if (!response.ok) return { outcome: "refused" };
      const result: unknown = await response.json();
      if (
        typeof result !== "object" ||
        result === null ||
        !("account" in result) ||
        typeof result.account !== "string" ||
        result.account.length === 0 ||
        result.account.length > 256
      )
        return { outcome: "refused" };
      return { outcome: "accepted", account: result.account };
    } catch {
      return { outcome: "refused" };
    }
  };
}
