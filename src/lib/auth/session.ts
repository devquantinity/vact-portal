import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSessionToken, verifySessionToken, type SessionPayload } from "./jwt";

export { SESSION_COOKIE };
export type { SessionPayload };

export async function createSession(payload: SessionPayload) {
  const token = await signSessionToken(payload, env().SESSION_SECRET);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token, env().SESSION_SECRET);
}
