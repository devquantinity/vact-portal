import { createReadStream } from "node:fs";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import type { StorageAdapter } from "./adapter";

/** Stores files under UPLOAD_DIR (./uploads in the demo, a Docker volume later). Never served statically. */
export class LocalDiskStorage implements StorageAdapter {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    const full = path.resolve(this.root, safe);
    if (!full.startsWith(path.resolve(this.root))) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Buffer): Promise<string> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return key;
  }

  async getStream(key: string): Promise<Readable> {
    return createReadStream(this.resolve(key));
  }

  async getBuffer(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch(() => undefined);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
