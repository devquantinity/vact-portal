"use client";

import { useState } from "react";
import { Download, FileText, History } from "lucide-react";
import type { DocumentView } from "@/lib/requests/detail";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReviewStatusBadge } from "@/components/shared/status-badge";

/** File list with version history and an inline preview (PDF and images inline, others as download). */
export function DocumentPreview({ documents, showUploader = true }: { documents: DocumentView[]; showUploader?: boolean }) {
  const [selectedId, setSelectedId] = useState(documents[0]?.id ?? null);
  const selected = documents.find((d) => d.id === selectedId) ?? documents[0];
  if (!selected) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <ul className="space-y-2">
        {documents.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => setSelectedId(d.id)}
              className={cn(
                "w-full rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/60 cursor-pointer",
                d.id === selected.id && "border-primary ring-2 ring-primary/20",
              )}
            >
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.originalName}</p>
                  <p className="text-xs text-muted-foreground">
                    v{d.version} · {formatBytes(d.sizeBytes)} · {d.uploadedAt}
                    {showUploader ? ` · ${d.uploadedBy}${d.uploadedByRole === "STAFF" ? " (staff)" : ""}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <ReviewStatusBadge status={d.reviewStatus} />
                    {d.version !== documents[0].version ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        <History className="size-3" /> Previous version
                      </Badge>
                    ) : null}
                  </div>
                  {d.reviewComment ? <p className="mt-1 text-xs text-muted-foreground italic">“{d.reviewComment}”{d.reviewedBy ? ` — ${d.reviewedBy}` : ""}</p> : null}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{selected.originalName}</p>
          <Button asChild variant="outline" size="sm">
            <a href={selected.downloadUrl}>
              <Download /> Download
            </a>
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border bg-muted/30">
          {selected.previewable === "pdf" ? (
            <iframe title={selected.originalName} src={selected.previewUrl} className="h-[520px] w-full bg-white" />
          ) : selected.previewable === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.previewUrl} alt={selected.originalName} className="mx-auto max-h-[520px] w-auto object-contain" />
          ) : (
            <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <FileText className="size-8" />
              <p>No inline preview for this file type.</p>
              <Button asChild size="sm" variant="secondary">
                <a href={selected.downloadUrl}>Download to open</a>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
