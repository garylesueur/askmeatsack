import { randomBytes } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { FILE_MAX_BYTES } from "./schema";

export type StoredFile = {
  url: string;
  pathname: string;
};

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  publicBaseUrl?: string;
};

export type UploadBody = Buffer | Blob | File | Uint8Array | ArrayBuffer;

type EnvMap = Record<string, string | undefined>;

function firstEnv(env: EnvMap, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function createR2Client(config: R2Config): AwsClient {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
    retries: 3,
  });
}

export function readR2Config(env: EnvMap = process.env): R2Config | null {
  const accountId = firstEnv(env, ["R2_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID"]);
  const accessKeyId = firstEnv(env, ["R2_ACCESS_KEY_ID"]);
  const secretAccessKey = firstEnv(env, ["R2_SECRET_ACCESS_KEY"]);
  const bucket = firstEnv(env, ["R2_BUCKET_NAME", "R2_BUCKET"]);
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  const publicBaseUrl = firstEnv(env, ["R2_PUBLIC_BASE_URL"]);
  const jurisdiction = firstEnv(env, ["R2_JURISDICTION"]);
  const endpoint =
    firstEnv(env, ["R2_ENDPOINT"]) ??
    (jurisdiction
      ? `https://${accountId}.${jurisdiction}.r2.cloudflarestorage.com`
      : `https://${accountId}.r2.cloudflarestorage.com`);

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: endpoint.replace(/\/$/, ""),
    publicBaseUrl: publicBaseUrl?.replace(/\/$/, ""),
  };
}

export function fileStoreAvailable(env: EnvMap = process.env): boolean {
  return readR2Config(env) !== null;
}

export function fileObjectKey(input: {
  sessionId: string;
  questionId: string;
  filename: string;
  suffix: string;
}): string {
  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return `askmeatsack/${input.sessionId}/${input.questionId}/${input.suffix}-${safeName}`;
}

export function publicFileUrl(publicBaseUrl: string, key: string): string {
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `${publicBaseUrl.replace(/\/$/, "")}/${encoded}`;
}

export function r2ObjectUrl(config: R2Config, key: string): string {
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `${config.endpoint}/${config.bucket}/${encoded}`;
}

export async function bytesFromUploadBody(body: UploadBody): Promise<Uint8Array> {
  if (body instanceof Uint8Array) {
    return body;
  }
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }
  return new Uint8Array(await body.arrayBuffer());
}

export function storageKeyFromFile(file: {
  key?: string;
  url: string;
}): string | null {
  if (file.key) {
    return file.key;
  }
  try {
    const url = new URL(file.url);
    const marker = "/askmeatsack/";
    const index = url.pathname.indexOf(marker);
    if (index < 0) {
      return null;
    }
    return decodeURIComponent(url.pathname.slice(index + 1));
  } catch {
    return null;
  }
}

export function contentDispositionFilename(filename: string): string {
  const safe = filename.replace(/["\\\r\n]/g, "_").slice(0, 80) || "upload";
  return `attachment; filename="${safe}"`;
}

async function readR2Error(response: Response): Promise<string> {
  const text = (await response.text()).replace(/\s+/g, " ").trim();
  return text.slice(0, 300);
}

export function createR2Sender(config: R2Config): (input: {
  key: string;
  body: UploadBody;
  contentType: string;
}) => Promise<void> {
  const client = createR2Client(config);

  return async (input) => {
    const body = await bytesFromUploadBody(input.body);
    const payload = new Uint8Array(body.byteLength);
    payload.set(body);
    const response = await client.fetch(r2ObjectUrl(config, input.key), {
      method: "PUT",
      body: payload.buffer,
      headers: {
        "Content-Type": input.contentType || "application/octet-stream",
        "Content-Length": String(payload.byteLength),
      },
    });
    if (!response.ok) {
      const detail = await readR2Error(response);
      throw new Error(`R2 refused the upload (${response.status}) ${detail}`);
    }
  };
}

export function createAnswerFileStore(deps: {
  config: R2Config;
  send: (input: {
    key: string;
    body: UploadBody;
    contentType: string;
  }) => Promise<void>;
  randomSuffix?: () => string;
}) {
  return {
    async put(input: {
      sessionId: string;
      questionId: string;
      filename: string;
      body: UploadBody;
      contentType: string;
    }): Promise<StoredFile> {
      const pathname = fileObjectKey({
        sessionId: input.sessionId,
        questionId: input.questionId,
        filename: input.filename,
        suffix: deps.randomSuffix?.() ?? randomBytes(8).toString("hex"),
      });
      await deps.send({
        key: pathname,
        body: input.body,
        contentType: input.contentType,
      });
      const publicBaseUrl = deps.config.publicBaseUrl;
      return {
        url: publicBaseUrl ? publicFileUrl(publicBaseUrl, pathname) : pathname,
        pathname,
      };
    },
  };
}

export async function storeAnswerFile(input: {
  sessionId: string;
  questionId: string;
  filename: string;
  body: UploadBody;
  contentType: string;
}): Promise<StoredFile> {
  const config = readR2Config();
  if (!config) {
    throw new Error("File storage is not configured");
  }
  return createAnswerFileStore({
    config,
    send: createR2Sender(config),
  }).put(input);
}

export async function fetchAnswerFile(key: string): Promise<Response> {
  const config = readR2Config();
  if (!config) {
    throw new Error("File storage is not configured");
  }
  const client = createR2Client(config);
  const response = await client.fetch(r2ObjectUrl(config, key), {
    method: "GET",
  });
  if (!response.ok) {
    const detail = await readR2Error(response);
    throw new Error(`R2 refused the download (${response.status}) ${detail}`);
  }
  return response;
}

export function fileTooLarge(size: number): boolean {
  return size > FILE_MAX_BYTES;
}
