import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { EXTENSION_MIME, TEXT_EXTENSIONS, extensionOf, type AllowedExtension } from "./extensions";

export type ValidatedFile = {
  originalName: string;
  extension: string;
  mimeType: string;
  bytes: Buffer;
  compressed: boolean;
};

export type FileRule = { acceptedExtensions: string[]; maxSizeMb: number };

const COMPRESS_THRESHOLD = 1024 * 1024; // 1 MB

/**
 * Checks extension and size, sniffs the real MIME type from the bytes and rejects mismatches,
 * then compresses large JPG/PNG photos with sharp. Throws Error with a client-friendly message.
 */
export async function validateAndPrepare(file: { name: string; bytes: Buffer }, rule: FileRule): Promise<ValidatedFile> {
  const extension = extensionOf(file.name);
  if (!extension || !rule.acceptedExtensions.includes(extension)) {
    throw new Error(`"${file.name}" is not an accepted file type. Allowed: ${rule.acceptedExtensions.map((e) => `.${e}`).join(", ")}.`);
  }
  const maxBytes = rule.maxSizeMb * 1024 * 1024;
  if (file.bytes.length === 0) throw new Error(`"${file.name}" is empty.`);
  if (file.bytes.length > maxBytes) {
    throw new Error(`"${file.name}" is larger than ${rule.maxSizeMb} MB.`);
  }

  const allowedMimes = EXTENSION_MIME[extension as AllowedExtension] ?? [];
  const sniffed = await fileTypeFromBuffer(file.bytes);
  let mimeType: string;
  if (sniffed) {
    if (!allowedMimes.includes(sniffed.mime)) {
      throw new Error(`"${file.name}" does not look like a .${extension} file (detected ${sniffed.mime}).`);
    }
    mimeType = sniffed.mime;
  } else if (TEXT_EXTENSIONS.includes(extension as AllowedExtension)) {
    mimeType = allowedMimes[0];
  } else {
    throw new Error(`"${file.name}" could not be verified as a .${extension} file.`);
  }

  let bytes = file.bytes;
  let compressed = false;
  if ((mimeType === "image/jpeg" || mimeType === "image/png") && bytes.length > COMPRESS_THRESHOLD) {
    const image = sharp(bytes, { failOn: "none" }).rotate().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true });
    const out = mimeType === "image/jpeg" ? await image.jpeg({ quality: 80, mozjpeg: true }).toBuffer() : await image.png({ compressionLevel: 9 }).toBuffer();
    if (out.length < bytes.length) {
      bytes = out;
      compressed = true;
    }
  }
  return { originalName: file.name, extension, mimeType, bytes, compressed };
}
