import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_HOURS = 48;

/** Returns the raw token (goes in the link) and its SHA-256 hash (goes in the database). */
export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function inviteExpiry(now = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_HOURS * 60 * 60 * 1000);
}
