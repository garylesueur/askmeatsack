"use client";

import { useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { filesFromList, formatFileSize } from "@/lib/files";
import { FILE_MAX_BYTES, FILE_MAX_COUNT } from "@/lib/schema";
import type { SessionFile } from "@/lib/session-store";
import { cn } from "@/lib/utils";

export function FileAttachField({
  files,
  disabled,
  onAdd,
}: {
  files: SessionFile[];
  disabled?: boolean;
  onAdd: (incoming: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  const browseRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const remaining = FILE_MAX_COUNT - files.length;
  const full = remaining <= 0;

  function takeFromInput(list: FileList | null): void {
    if (!list) {
      return;
    }
    onAdd(filesFromList(list));
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled && !full) {
            setOver(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !full) {
            setOver(true);
          }
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) {
            return;
          }
          setOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          if (disabled || full) {
            return;
          }
          onAdd(filesFromList(event.dataTransfer.files));
        }}
        role="group"
        aria-label="Attach files"
        onClick={(event) => {
          if (disabled || full) {
            return;
          }
          if ((event.target as HTMLElement).closest("button")) {
            return;
          }
          browseRef.current?.click();
        }}
        className={cn(
          "flex flex-col gap-2 rounded-lg border border-dashed px-3 py-3",
          over ? "border-foreground bg-muted/50" : "border-border",
          disabled || full ? "" : "cursor-pointer",
        )}
      >
        <p className="text-sm text-muted-foreground">
          {full
            ? `That is ${FILE_MAX_COUNT} files, the most on one question.`
            : "Drop files here, or choose them. A photo is fine."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || full}
            onClick={() => {
              browseRef.current?.click();
            }}
          >
            <Upload />
            Choose files
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || full}
            onClick={() => {
              cameraRef.current?.click();
            }}
          >
            <Camera />
            Take a photo
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Up to {FILE_MAX_COUNT} files, {formatFileSize(FILE_MAX_BYTES)} each
          {files.length > 0 ? ` · ${files.length} attached` : ""}
        </p>
        <input
          ref={browseRef}
          type="file"
          multiple
          className="sr-only"
          disabled={disabled || full}
          onChange={(event) => {
            takeFromInput(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={disabled || full}
          onChange={(event) => {
            takeFromInput(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {files.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {files.map((file) => (
            <li key={file.id} className="text-sm text-foreground">
              {file.filename}
              <span className="text-muted-foreground"> · {formatFileSize(file.size)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
