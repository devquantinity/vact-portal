import { Readable } from "node:stream";
import { BlobNotFoundError, del, get, head, put } from "@vercel/blob";
import type { StorageAdapter } from "./adapter";

/**
 * Vercel Blob, private store. Files are never public: every read goes through `get()` inside our own
 * route handler, after the session and company checks. Needs BLOB_READ_WRITE_TOKEN (or Vercel OIDC).
 */
export class VercelBlobStorage implements StorageAdapter {
  constructor(private readonly token?: string) {}

  private opts() {
    return this.token ? { token: this.token } : {};
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const blob = await put(key, data, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
      ...this.opts(),
    });
    return blob.pathname;
  }

  async getStream(key: string): Promise<Readable> {
    const result = await get(key, { access: "private", useCache: false, ...this.opts() });
    if (!result || result.statusCode !== 200) throw new Error(`Blob not found: ${key}`);
    return Readable.fromWeb(result.stream as import("node:stream/web").ReadableStream<Uint8Array>);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const stream = await this.getStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await del(key, this.opts());
  }

  async exists(key: string): Promise<boolean> {
    try {
      await head(key, this.opts());
      return true;
    } catch (err) {
      if (err instanceof BlobNotFoundError) return false;
      throw err;
    }
  }
}
