import { createHmac, timingSafeEqual } from "node:crypto";
const SCAN_SIZE_CAP_BYTES = 4 * 1024 * 1024;

export const SCAN_LINK_TTL_SECONDS = 2 * 60 * 60;
export const CLEANROOM_SIGNATURE_HEADER = "cleanroom-signature";
const SIGNATURE_TOLERANCE_MS = 5 * 60_000;

export type CleanroomVerdict =
  | { verdict: "clean" }
  | { verdict: "infected"; signature: string }
  | { verdict: "too-large"; declaredSizeBytes: number; capBytes: number }
  | { verdict: "failed"; reason: string };

export type ScanSubmitResult = {
  handle: string;
  state: "waiting" | "scanning" | "finished";
  verdict: CleanroomVerdict | null;
};

export type ScanPollResult = ScanSubmitResult;

export type SubmitScanInput = {
  url: string;
  callbackUrl: string;
  declaredSizeBytes: number;
  submissionKey: string;
};

export type Cleanroom = {
  available(): boolean;
  submit(input: SubmitScanInput): Promise<ScanSubmitResult>;
  poll(handle: string): Promise<ScanPollResult | null>;
  verifyCallback(payload: string, header: string | null | undefined): boolean;
};

export type CleanroomConfig = {
  baseUrl: string;
  credential: string;
  webhookSecret: string;
};

export function readCleanroomConfig(
  env: Record<string, string | undefined> = process.env,
): CleanroomConfig | null {
  const baseUrl = env.CLEANROOM_URL?.replace(/\/$/, "");
  const credential = env.CLEANROOM_SERVICE_CREDENTIAL?.trim();
  const webhookSecret = env.CLEANROOM_WEBHOOK_SECRET?.trim();
  if (!baseUrl || !credential || !webhookSecret) {
    return null;
  }
  return { baseUrl, credential, webhookSecret };
}

export function verifyCleanroomSignature(input: {
  payload: string;
  header: string | null | undefined;
  secret: string;
  now?: Date;
}): boolean {
  if (!input.header || !input.secret) {
    return false;
  }
  const parts = new Map<string, string>();
  for (const segment of input.header.split(",")) {
    const separator = segment.indexOf("=");
    if (separator > 0) {
      parts.set(segment.slice(0, separator).trim(), segment.slice(separator + 1).trim());
    }
  }
  const seconds = Number(parts.get("t"));
  const presented = parts.get("v1");
  if (!presented || !Number.isFinite(seconds)) {
    return false;
  }
  const now = input.now ?? new Date();
  if (Math.abs(now.getTime() - seconds * 1000) > SIGNATURE_TOLERANCE_MS) {
    return false;
  }
  const expected = createHmac("sha256", input.secret)
    .update(`${seconds}.${input.payload}`)
    .digest("hex");
  const left = Buffer.from(presented, "utf8");
  const right = Buffer.from(expected, "utf8");
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function createHttpCleanroom(
  config: CleanroomConfig,
  fetchImpl: typeof fetch = fetch,
): Cleanroom {
  return {
    available() {
      return true;
    },
    async submit(input) {
      const response = await fetchImpl(`${config.baseUrl}/v1/scans`, {
        method: "POST",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.credential}`,
        },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        throw new Error(`cleanroom refused the submit (${response.status})`);
      }
      return unwrapScan(await response.json());
    },
    async poll(handle) {
      const response = await fetchImpl(`${config.baseUrl}/v1/scans/${encodeURIComponent(handle)}`, {
        headers: { authorization: `Bearer ${config.credential}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`cleanroom could not answer the poll (${response.status})`);
      }
      return unwrapScan(await response.json());
    },
    verifyCallback(payload, header) {
      return verifyCleanroomSignature({ payload, header, secret: config.webhookSecret });
    },
  };
}

function unwrapScan(body: unknown): ScanSubmitResult {
  const data =
    body && typeof body === "object" && "data" in body
      ? (body as { data: Record<string, unknown> }).data
      : (body as Record<string, unknown>);
  if (!data || typeof data !== "object") throw new Error("Invalid scan response");
  const handle = typeof data.handle === "string" ? data.handle : "";
  if (!handle || handle.length > 256) throw new Error("Invalid scan handle");
  const state = data.state === "finished" || data.state === "scanning" ? data.state : "waiting";
  const verdict = parseVerdict(data.verdict);
  return { handle, state, verdict };
}

function parseVerdict(value: unknown): CleanroomVerdict | null {
  if (!value || typeof value !== "object" || !("verdict" in value)) {
    return null;
  }
  const verdict = (value as { verdict: string }).verdict;
  if (verdict === "clean") {
    return { verdict: "clean" };
  }
  if (verdict === "infected") {
    const signature = (value as { signature?: string }).signature;
    return { verdict: "infected", signature: signature?.trim() || "unknown" };
  }
  if (verdict === "too-large") {
    const declaredSizeBytes = Number((value as { declaredSizeBytes?: number }).declaredSizeBytes);
    const capBytes = Number((value as { capBytes?: number }).capBytes);
    return {
      verdict: "too-large",
      declaredSizeBytes: Number.isFinite(declaredSizeBytes) ? declaredSizeBytes : 0,
      capBytes: Number.isFinite(capBytes) ? capBytes : SCAN_SIZE_CAP_BYTES,
    };
  }
  if (verdict === "failed") {
    const reason = (value as { reason?: string }).reason;
    return { verdict: "failed", reason: reason?.trim() || "scan could not be completed" };
  }
  return null;
}
