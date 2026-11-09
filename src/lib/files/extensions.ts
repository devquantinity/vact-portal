/** File types the portal knows how to validate (extension ↔ sniffed MIME). */
export const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "heic", "docx", "doc", "xlsx", "xls", "csv", "zip"] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

/** MIME types accepted for each extension (what `file-type` sniffs from the bytes). */
export const EXTENSION_MIME: Record<AllowedExtension, string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  heic: ["image/heic", "image/heif"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  doc: ["application/msword", "application/x-cfb"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  xls: ["application/vnd.ms-excel", "application/x-cfb"],
  csv: ["text/csv", "text/plain"],
  zip: ["application/zip"],
};

/** Extensions whose content has no magic bytes; they are accepted on extension alone. */
export const TEXT_EXTENSIONS: AllowedExtension[] = ["csv"];

export function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx + 1).toLowerCase();
}

export function acceptAttribute(extensions: string[]): string {
  return extensions.map((e) => `.${e}`).join(",");
}
