import { env } from "@/lib/env";

/**
 * The size a single upload may have: the document type's limit, capped by MAX_UPLOAD_MB when the host
 * imposes one (Vercel functions accept request bodies up to 4.5 MB).
 */
export function effectiveMaxSizeMb(documentTypeMaxMb: number): number {
  const cap = env().MAX_UPLOAD_MB;
  return cap ? Math.min(documentTypeMaxMb, cap) : documentTypeMaxMb;
}
