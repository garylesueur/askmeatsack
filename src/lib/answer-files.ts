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
  publicBaseUrl: string;
};

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

export function readR2Config(env: EnvMap = process.env): R2Config | null {
  const accountId = firstEnv(env, ["R2_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID"]);
  const accessKeyId = firstEnv(env, ["R2_ACCESS_KEY_ID"]);
  const secretAccessKey = firstEnv(env, ["R2_SECRET_ACCESS_KEY"]);
  const bucket = firstEnv(env, ["R2_BUCKET_NAME", "R2_BUCKET"]);
  const publicBaseUrl = firstEnv(env, ["R2_PUBLIC_BASE_URL"]);
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }

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
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ""),
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

export function createR2Sender(config: R2Config): (input: {
  key: string;
  body: Buffer | Blob | File;
  contentType: string;
}) => Promise<void> {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });

  return async (input) => {
    const body =
      input.body instanceof Blob ? input.body : new Uint8Array(input.body);
    const response = await client.fetch(r2ObjectUrl(config, input.key), {
      method: "PUT",
      body,
      headers: {
        "Content-Type": input.contentType,
      },
    });
    if (!response.ok) {
      throw new Error("R2 refused the upload");
    }
  };
}

export function createAnswerFileStore(deps: {
  config: R2Config;
  send: (input: {
    key: string;
    body: Buffer | Blob | File;
    contentType: string;
  }) => Promise<void>;
  randomSuffix?: () => string;
}) {
  return {
    async put(input: {
      sessionId: string;
      questionId: string;
      filename: string;
      body: Buffer | Blob | File;
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
      return {
        url: publicFileUrl(deps.config.publicBaseUrl, pathname),
        pathname,
      };
    },
  };
}

export async function storeAnswerFile(input: {
  sessionId: string;
  questionId: string;
  filename: string;
  body: Buffer | Blob | File;
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

export function fileTooLarge(size: number): boolean {
  return size > FILE_MAX_BYTES;
}
