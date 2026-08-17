import { describe, expect, it } from "vitest";
import { filesFromList, formatFileSize, takeAttachableFiles } from "./files";

function namedFile(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type: "text/plain" });
}

describe("file size labels", () => {
  it("uses bytes, kilobytes, and megabytes", () => {
    expect(formatFileSize(400)).toBe("400 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(4 * 1024 * 1024)).toBe("4.0 MB");
  });
});

describe("file lists", () => {
  it("copies a FileList-shaped list into an array", () => {
    const first = namedFile("a.txt", 4);
    const second = namedFile("b.txt", 8);
    expect(filesFromList([first, second])).toEqual([first, second]);
  });
});

describe("attachable files", () => {
  it("keeps files that fit the count and size limits", () => {
    const first = namedFile("a.txt", 10);
    const second = namedFile("b.txt", 10);
    expect(
      takeAttachableFiles({
        incoming: [first, second],
        already: 0,
        maxCount: 5,
        maxBytes: 100,
      }),
    ).toEqual({ accepted: [first, second] });
  });

  it("skips a file that is too large and still takes the rest", () => {
    const huge = namedFile("huge.bin", 50);
    const ok = namedFile("ok.txt", 10);
    expect(
      takeAttachableFiles({
        incoming: [huge, ok],
        already: 0,
        maxCount: 5,
        maxBytes: 20,
      }),
    ).toEqual({
      accepted: [ok],
      error: "Each file must be at most 4 MB.",
    });
  });

  it("stops once the question is full", () => {
    const extra = namedFile("extra.txt", 10);
    expect(
      takeAttachableFiles({
        incoming: [extra],
        already: 5,
        maxCount: 5,
        maxBytes: 100,
      }),
    ).toEqual({
      accepted: [],
      error: "At most 5 files on this question.",
    });
  });
});
