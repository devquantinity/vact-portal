import type { Readable } from "node:stream";
import type { StorageAdapter } from "./adapter";

/**
 * TODO (after V ACT approves): DigitalOcean Spaces implementation.
 * - private bucket, S3-compatible API via @aws-sdk/client-s3 with the Spaces endpoint
 * - put/get/delete by key, signed GET URLs for downloads, second bucket for backup
 * - env: SPACES_KEY, SPACES_SECRET, SPACES_BUCKET, SPACES_REGION (sgp1), SPACES_ENDPOINT
 * - one-off migration of ./uploads into the bucket
 */
export class SpacesStorage implements StorageAdapter {
  constructor(readonly config: { bucket: string; region: string; endpoint: string }) {}

  private notImplemented(): never {
    throw new Error(`SpacesStorage (${this.config.bucket}) is not implemented in the demo build`);
  }

  put(): Promise<string> {
    return this.notImplemented();
  }
  getStream(): Promise<Readable> {
    return this.notImplemented();
  }
  getBuffer(): Promise<Buffer> {
    return this.notImplemented();
  }
  delete(): Promise<void> {
    return this.notImplemented();
  }
  exists(): Promise<boolean> {
    return this.notImplemented();
  }
}
