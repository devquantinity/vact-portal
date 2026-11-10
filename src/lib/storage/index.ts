import path from "node:path";
import { env } from "@/lib/env";
import { LocalDiskStorage } from "./local-disk";
import { VercelBlobStorage } from "./vercel-blob";
import type { StorageAdapter } from "./adapter";

let instance: StorageAdapter | null = null;

export type StorageDriver = "local" | "blob";

/** `STORAGE_DRIVER` wins; otherwise Vercel Blob when a token is present, local disk on the laptop. */
export function storageDriver(): StorageDriver {
  const e = env();
  if (e.STORAGE_DRIVER) return e.STORAGE_DRIVER;
  return e.BLOB_READ_WRITE_TOKEN ? "blob" : "local";
}

export function storage(): StorageAdapter {
  if (!instance) {
    instance =
      storageDriver() === "blob"
        ? new VercelBlobStorage(env().BLOB_READ_WRITE_TOKEN || undefined)
        : new LocalDiskStorage(path.resolve(process.cwd(), env().UPLOAD_DIR));
  }
  return instance;
}

export type { StorageAdapter } from "./adapter";
