const FILE_MAX_BYTES = 4 * 1024 * 1024;
const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
const GIF = [0x47, 0x49, 0x46];

export const SKETCH_BACKGROUND_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export type SketchBackgroundInput = {
  filename: string;
  contentType: string;
  data: string;
};

export type SketchBackgroundBytes =
  | { ok: true; bytes: Buffer; contentType: string; filename: string }
  | { ok: false; code: "sketch_background_unusable"; message: string };

function looksLikeImage(bytes: Buffer, contentType: string): boolean {
  if (bytes.length < 12) {
    return false;
  }
  if (contentType === "image/png") {
    return PNG.every((value, index) => bytes[index] === value);
  }
  if (contentType === "image/jpeg" || contentType === "image/jpg") {
    return JPEG.every((value, index) => bytes[index] === value);
  }
  if (contentType === "image/gif") {
    return GIF.every((value, index) => bytes[index] === value);
  }
  if (contentType === "image/webp") {
    return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

export function parseSketchBackground(input: SketchBackgroundInput): SketchBackgroundBytes {
  const contentType = input.contentType.trim().toLowerCase();
  if (!SKETCH_BACKGROUND_TYPES.has(contentType)) {
    return {
      ok: false,
      code: "sketch_background_unusable",
      message: "Sketch background must be a PNG, JPEG, WebP, or GIF image",
    };
  }
  let bytes: Buffer;
  try {
    bytes = Buffer.from(input.data, "base64");
  } catch {
    return {
      ok: false,
      code: "sketch_background_unusable",
      message: "Sketch background must be a usable image",
    };
  }
  if (bytes.length === 0 || bytes.length > FILE_MAX_BYTES) {
    return {
      ok: false,
      code: "sketch_background_unusable",
      message: "Sketch background must be a usable image",
    };
  }
  const normalised = contentType === "image/jpg" ? "image/jpeg" : contentType;
  if (!looksLikeImage(bytes, normalised)) {
    return {
      ok: false,
      code: "sketch_background_unusable",
      message: "Sketch background must be a usable image",
    };
  }
  return {
    ok: true,
    bytes,
    contentType: normalised,
    filename: input.filename.trim() || "background",
  };
}
