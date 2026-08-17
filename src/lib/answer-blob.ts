import { put } from "@vercel/blob";
import { FILE_MAX_BYTES } from "./schema";

export type StoredBlob = {
  url: string;
  pathname: string;
};

export function blobStoreAvailable(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function storeAnswerBlob(input: {
  sessionId: string;
  questionId: string;
  filename: string;
  body: Buffer | Blob | File;
  contentType: string;
}): Promise<StoredBlob> {
  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const pathname = `askmeatsack/${input.sessionId}/${input.questionId}/${safeName}`;
  const blob = await put(pathname, input.body, {
    access: "public",
    addRandomSuffix: true,
    contentType: input.contentType,
  });
  return { url: blob.url, pathname: blob.pathname };
}

export function fileTooLarge(size: number): boolean {
  return size > FILE_MAX_BYTES;
}
