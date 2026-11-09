import { createHmac, timingSafeEqual } from "node:crypto";

/** Validates Meta's X-Hub-Signature-256 header (sha256=<hex HMAC of the raw body with the app secret>). */
export function validMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!appSecret) return true; // no app secret configured (local dev without webhooks): accept
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = header.slice("sha256=".length);
  if (!/^[0-9a-f]+$/i.test(given)) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(given, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function metaSignatureFor(rawBody: string, appSecret: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
}
