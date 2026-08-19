import { describe, expect, it } from "vitest";
import {
  bytesFromUploadBody,
  contentDispositionFilename,
  createAnswerFileStore,
  fileObjectKey,
  fileStoreAvailable,
  publicFileUrl,
  r2ObjectUrl,
  readR2Config,
  storageKeyFromFile,
} from "./answer-files";

const usableEnv = {
  R2_ACCOUNT_ID: "acct123",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET_NAME: "ask-files",
  R2_PUBLIC_BASE_URL: "https://files.example.com/",
};

describe("R2 file store config", () => {
  it("is missing until account, keys, and bucket are all set", () => {
    expect(fileStoreAvailable({})).toBe(false);
    expect(fileStoreAvailable({ ...usableEnv, R2_PUBLIC_BASE_URL: "" })).toBe(true);
    expect(fileStoreAvailable(usableEnv)).toBe(true);
  });

  it("accepts the usual aliases and a jurisdiction endpoint", () => {
    const config = readR2Config({
      CLOUDFLARE_ACCOUNT_ID: "acct123",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET: "ask-files",
      R2_PUBLIC_BASE_URL: "https://files.example.com",
      R2_JURISDICTION: "eu",
    });
    expect(config).toMatchObject({
      accountId: "acct123",
      bucket: "ask-files",
      endpoint: "https://acct123.eu.r2.cloudflarestorage.com",
      publicBaseUrl: "https://files.example.com",
    });
  });

  it("prefers an explicit endpoint", () => {
    const config = readR2Config({
      ...usableEnv,
      R2_ENDPOINT: "https://acct123.r2.cloudflarestorage.com/",
    });
    expect(config?.endpoint).toBe("https://acct123.r2.cloudflarestorage.com");
  });
});

describe("R2 object keys and public URLs", () => {
  it("keeps a safe name and a random suffix", () => {
    expect(
      fileObjectKey({
        sessionId: "sess",
        questionId: "photo",
        filename: "My receipt!.JPG",
        suffix: "ab12",
      }),
    ).toBe("askmeatsack/sess/photo/ab12-My_receipt_.JPG");
  });

  it("Keeps a caller from choosing its own prefix", () => {
    expect(
      fileObjectKey({
        sessionId: "sess/../../elsewhere",
        questionId: "a/b",
        filename: "x.txt",
        suffix: "ab12",
      }),
    ).toBe("askmeatsack/sess_.._.._elsewhere/a_b/ab12-x.txt");
  });

  it("Replaces dot-only segments, which are never real ids", () => {
    expect(
      fileObjectKey({
        sessionId: "..",
        questionId: ".",
        filename: "x.txt",
        suffix: "ab12",
      }),
    ).toBe("askmeatsack/_/_/ab12-x.txt");
  });

  it("builds the S3 and public URLs from the key", () => {
    const key = "askmeatsack/sess/photo/ab12-notes.txt";
    expect(
      r2ObjectUrl(
        {
          accountId: "acct123",
          accessKeyId: "key",
          secretAccessKey: "secret",
          bucket: "ask-files",
          endpoint: "https://acct123.r2.cloudflarestorage.com",
          publicBaseUrl: "https://files.example.com",
        },
        key,
      ),
    ).toBe(
      "https://acct123.r2.cloudflarestorage.com/ask-files/askmeatsack/sess/photo/ab12-notes.txt",
    );
    expect(publicFileUrl("https://files.example.com/", key)).toBe(
      "https://files.example.com/askmeatsack/sess/photo/ab12-notes.txt",
    );
  });
});

describe("answer file store", () => {
  it("puts the object then returns the public URL", async () => {
    const sent: { key: string; contentType: string }[] = [];
    const store = createAnswerFileStore({
      config: readR2Config(usableEnv)!,
      randomSuffix: () => "ab12cd34",
      send: async (input) => {
        sent.push({ key: input.key, contentType: input.contentType });
      },
    });

    const stored = await store.put({
      sessionId: "sess",
      questionId: "photo",
      filename: "desk.jpg",
      body: Buffer.from("hi"),
      contentType: "image/jpeg",
    });

    expect(sent).toEqual([
      {
        key: "askmeatsack/sess/photo/ab12cd34-desk.jpg",
        contentType: "image/jpeg",
      },
    ]);
    expect(stored).toEqual({
      pathname: "askmeatsack/sess/photo/ab12cd34-desk.jpg",
      url: "https://files.example.com/askmeatsack/sess/photo/ab12cd34-desk.jpg",
    });
  });
});

describe("upload body bytes", () => {
  it("reads a Blob so retries can send the same payload", async () => {
    const body = new Blob(["pdf-bytes"]);
    const bytes = await bytesFromUploadBody(body);
    expect(Array.from(bytes)).toEqual(Array.from(new TextEncoder().encode("pdf-bytes")));
  });
});

describe("stored file keys", () => {
  it("prefers the saved key, then the path on a legacy R2 URL", () => {
    expect(
      storageKeyFromFile({
        key: "askmeatsack/sess/photo/ab12-desk.jpg",
        url: "https://askmeatsack.com/api/v1/sessions/sess/files/file-1?t=tok",
      }),
    ).toBe("askmeatsack/sess/photo/ab12-desk.jpg");
    expect(
      storageKeyFromFile({
        url: "https://acct123.r2.cloudflarestorage.com/askmeatsack/sess/photo/ab12-desk.jpg",
      }),
    ).toBe("askmeatsack/sess/photo/ab12-desk.jpg");
    expect(contentDispositionFilename('nasty"name.pdf')).toBe(
      'attachment; filename="nasty_name.pdf"',
    );
  });
});
