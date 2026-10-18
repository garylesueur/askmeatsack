import { AwsClient } from "aws4fetch";
import { readR2Config, r2ObjectUrl, type R2Config } from "./answer-files";
import { validLegacyAskClaimKey } from "./ask-attachment-protocol";
export async function boundedAskClaimBytes(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!response.ok || Number(response.headers.get("content-length")) > maxBytes)
    throw new Error("File observation unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body?.getReader();
  try {
    // A bounded stream is necessarily consumed in order.
    /* eslint-disable no-await-in-loop */
    if (reader)
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new Error("File observation exceeds its bound");
        }
        chunks.push(next.value);
      }
  } finally {
    reader?.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export function createLegacyAskClaimReader(config: R2Config) {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
    retries: 0,
  });
  return async (sourceId: string, questionId: string, sourceKey: string): Promise<Uint8Array> => {
    if (!validLegacyAskClaimKey(sourceId, questionId, sourceKey))
      throw new Error("Invalid legacy source key");
    const response = await client.fetch(r2ObjectUrl(config, sourceKey), {
      method: "GET",
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
      headers: { "Accept-Encoding": "identity" },
    });
    return boundedAskClaimBytes(response, 4 * 1024 * 1024);
  };
}
export function defaultLegacyAskClaimReader() {
  const config = readR2Config();
  return config ? createLegacyAskClaimReader(config) : null;
}
