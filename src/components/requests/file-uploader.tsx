"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CloudUpload, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { acceptAttribute, extensionOf } from "@/lib/files/extensions";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type Picked = { file: File; error: string | null };

export function FileUploader({
  requestId,
  acceptedExtensions,
  maxSizeMb,
  multiple,
  compact = false,
  onUploaded,
  successMessage = "Uploaded. V ACT will review it and let you know.",
}: {
  requestId: string;
  acceptedExtensions: string[];
  maxSizeMb: number;
  multiple: boolean;
  compact?: boolean;
  onUploaded?: () => void;
  successMessage?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    (file: File): string | null => {
      const ext = extensionOf(file.name);
      if (!acceptedExtensions.includes(ext)) return `Not accepted. Use ${acceptedExtensions.map((e) => `.${e}`).join(", ")}.`;
      if (file.size > maxSizeMb * 1024 * 1024) return `Larger than ${maxSizeMb} MB.`;
      if (file.size === 0) return "File is empty.";
      return null;
    },
    [acceptedExtensions, maxSizeMb],
  );

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list).map((file) => ({ file, error: validate(file) }));
    setDone(null);
    setError(null);
    setPicked((prev) => (multiple ? [...prev, ...incoming] : incoming.slice(0, 1)));
  }

  async function upload() {
    const valid = picked.filter((p) => !p.error);
    if (valid.length === 0) return;
    setError(null);
    setProgress(0);
    const form = new FormData();
    for (const p of valid) form.append("files", p.file, p.file.name);

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/requests/${requestId}/upload`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let body: { error?: string; documents?: { name: string }[] } = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* ignore */
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          setPicked([]);
          setProgress(null);
          setDone(successMessage);
          toast.success(`${body.documents?.length ?? valid.length} file${(body.documents?.length ?? valid.length) === 1 ? "" : "s"} uploaded`);
          onUploaded?.();
          router.refresh();
        } else {
          setProgress(null);
          setError(body.error ?? `Upload failed (HTTP ${xhr.status}).`);
        }
        resolve();
      };
      xhr.onerror = () => {
        setProgress(null);
        setError("Network error during upload. Check your connection and try again.");
        resolve();
      };
      xhr.send(form);
    });
  }

  const uploading = progress !== null;
  const canUpload = picked.some((p) => !p.error) && !uploading;

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors",
          compact ? "px-4 py-6" : "px-6 py-10",
          dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/60 hover:bg-accent/40",
        )}
      >
        <CloudUpload className={cn("mb-2 text-primary", compact ? "size-6" : "size-8")} />
        <p className="text-sm font-medium">{multiple ? "Tap to choose files, or drop them here" : "Tap to choose a file, or drop it here"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {acceptedExtensions.map((e) => e.toUpperCase()).join(", ")} · up to {maxSizeMb} MB{multiple ? " each" : ""}
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={acceptAttribute(acceptedExtensions)}
          multiple={multiple}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {picked.length > 0 ? (
        <ul className="space-y-2">
          {picked.map((p, i) => (
            <li key={`${p.file.name}-${i}`} className={cn("flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm", p.error && "border-destructive/40 bg-red-50")}>
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.file.name}</p>
                <p className={cn("text-xs", p.error ? "text-destructive" : "text-muted-foreground")}>{p.error ?? formatBytes(p.file.size)}</p>
              </div>
              {!uploading ? (
                <button type="button" aria-label={`Remove ${p.file.name}`} className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}>
                  <X className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {uploading ? (
        <div className="space-y-1.5">
          <Progress value={progress ?? 0} />
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Uploading… {progress}%
          </p>
        </div>
      ) : null}

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      {done ? (
        <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="size-4" /> {done}
        </p>
      ) : null}

      {picked.length > 0 ? (
        <div className="flex justify-end">
          <Button type="button" onClick={upload} disabled={!canUpload} size={compact ? "sm" : "default"}>
            {uploading ? <Loader2 className="animate-spin" /> : <CloudUpload />}
            {uploading ? "Uploading…" : `Upload ${picked.filter((p) => !p.error).length > 1 ? `${picked.filter((p) => !p.error).length} files` : "file"}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
