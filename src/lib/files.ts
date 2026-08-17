export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function filesFromList(list: FileList | File[]): File[] {
  const files: File[] = [];
  for (const file of list) {
    files.push(file);
  }
  return files;
}

export function takeAttachableFiles({
  incoming,
  already,
  maxCount,
  maxBytes,
}: {
  incoming: File[];
  already: number;
  maxCount: number;
  maxBytes: number;
}): { accepted: File[]; error?: string } {
  const accepted: File[] = [];
  let remaining = maxCount - already;
  let error: string | undefined;
  for (const file of incoming) {
    if (remaining <= 0) {
      error = `At most ${maxCount} files on this question.`;
      break;
    }
    if (file.size > maxBytes) {
      error = "Each file must be at most 4 MB.";
      continue;
    }
    accepted.push(file);
    remaining -= 1;
  }
  return error ? { accepted, error } : { accepted };
}
