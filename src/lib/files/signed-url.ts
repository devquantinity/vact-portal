import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const TTL_SECONDS = 10 * 60;

function sign(documentId: string, userId: string, exp: number): string {
  return createHmac("sha256", env().SESSION_SECRET).update(`${documentId}|${userId}|${exp}`).digest("base64url");
}

/** A download link that works for 10 minutes and only for the user who requested it. */
export function signedFileUrl(documentId: string, userId: string, options: { download?: boolean } = {}): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const sig = sign(documentId, userId, exp);
  const params = new URLSearchParams({ exp: String(exp), sig });
  if (options.download) params.set("download", "1");
  return `/api/files/${documentId}?${params.toString()}`;
}

export function verifyFileSignature(documentId: string, userId: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(sign(documentId, userId, expNum));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
