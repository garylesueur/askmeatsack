// A stream must be consumed sequentially to enforce its byte bound before reading more.
/* eslint-disable no-await-in-loop */
export async function boundedRequestText(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > maxBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    bytes += result.value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(result.value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
