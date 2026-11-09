import path from "node:path";
import { env } from "@/lib/env";
import { LocalDiskStorage } from "./local-disk";
import type { StorageAdapter } from "./adapter";

let instance: StorageAdapter | null = null;

export function storage(): StorageAdapter {
  if (!instance) instance = new LocalDiskStorage(path.resolve(process.cwd(), env().UPLOAD_DIR));
  return instance;
}

export type { StorageAdapter } from "./adapter";
