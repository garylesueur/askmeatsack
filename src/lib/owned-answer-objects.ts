import { AwsClient } from "aws4fetch";
import { readR2Config, r2ObjectUrl, type R2Config } from "./answer-files";
import { boundedAskClaimBytes } from "./ask-attachment-objects";

export type AskObjects = {
  read?(key: string, maxBytes: number): Promise<Uint8Array>;
  put(key: string, bytes: Uint8Array, type: string): Promise<void>;
  head(key: string): Promise<{ size: number } | null>;
  copy(source: string, target: string): Promise<void>;
  delete(key: string): Promise<void>;
  scanUrl(key: string): Promise<string>;
};
export function createOwnedAnswerObjects(config: R2Config): AskObjects {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
    retries: 0,
  });
  const target = (key: string) => {
    if (!/^askmeatsack\/(owned|kept)\/[A-Za-z0-9_-]+\/[A-Za-z0-9_/-]+$/.test(key))
      throw new Error("Invalid owned object key");
    return r2ObjectUrl(config, key);
  };
  return {
    async read(key, maxBytes) {
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > 4 * 1024 * 1024)
        throw new Error("Invalid read bound");
      const response = await client.fetch(target(key), {
        method: "GET",
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
        headers: { "Accept-Encoding": "identity" },
      });
      return boundedAskClaimBytes(response, maxBytes);
    },
    async put(key, bytes, type) {
      if (!key.endsWith("/upload")) throw new Error("Upload must target staging");
      const payload = new Uint8Array(bytes);
      const response = await client.fetch(target(key), {
        method: "PUT",
        body: payload.buffer,
        signal: AbortSignal.timeout(45_000),
        headers: { "Content-Type": type, "Content-Length": String(bytes.byteLength) },
      });
      if (!response.ok) throw new Error("Storage refused upload");
    },
    async head(key) {
      const response = await client.fetch(target(key), {
        method: "HEAD",
        signal: AbortSignal.timeout(15_000),
        headers: { "Accept-Encoding": "identity" },
      });
      if (response.status === 404) return null;
      const length = response.headers.get("content-length");
      const size = Number(length);
      if (!response.ok || !length || !Number.isSafeInteger(size) || size < 0)
        throw new Error("Storage metadata unavailable");
      return { size };
    },
    async copy(source, destination) {
      if (source === destination || !destination.includes("/sealed/"))
        throw new Error("Invalid sealed copy");
      target(source);
      const copySource = [config.bucket, ...source.split("/")].map(encodeURIComponent).join("/");
      const response = await client.fetch(target(destination), {
        method: "PUT",
        headers: { "x-amz-copy-source": `/${copySource}` },
        signal: AbortSignal.timeout(45_000),
      });
      const result = await response.text();
      if (
        response.status !== 200 ||
        !/<CopyObjectResult(?:\s|>)/.test(result) ||
        !result.includes("</CopyObjectResult>") ||
        /<Error(?:\s|>)/.test(result)
      )
        throw new Error("Storage did not confirm copy");
    },
    async delete(key) {
      const response = await client.fetch(target(key), {
        method: "DELETE",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok && response.status !== 404) throw new Error("Storage cleanup failed");
    },
    async scanUrl(key) {
      const url = new URL(target(key));
      url.searchParams.set("X-Amz-Expires", "7200");
      const signed = await client.sign(new Request(url, { method: "GET" }), {
        aws: { signQuery: true },
      });
      return signed.url;
    },
  };
}
export function defaultOwnedAnswerObjects(): AskObjects | null {
  const config = readR2Config();
  return config ? createOwnedAnswerObjects(config) : null;
}
