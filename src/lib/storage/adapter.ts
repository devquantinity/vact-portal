import type { Readable } from "node:stream";

/**
 * Where uploaded files live. The demo uses the local disk; production swaps in SpacesStorage
 * (DigitalOcean Spaces) without touching the rest of the app.
 */
export interface StorageAdapter {
  /** Writes bytes under a key and returns the key. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Streams the object back. */
  getStream(key: string): Promise<Readable>;
  /** Reads the whole object into memory (small files only). */
  getBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
