"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { checkRateLimit, clearAttempts, rateLimitKey, recordAttempt } from "@/lib/auth/rate-limit";
import { generateToken, hashToken, inviteExpiry } from "@/lib/auth/tokens";
import { getSessionUser, roleHome } from "@/lib/auth/require";
import { sendInvite } from "@/lib/messaging/notify";

export type FormState = { error?: string; success?: string } | null;

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function safeNext(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const email = parsed.data.email.toLowerCase();
  const key = rateLimitKey("login", await clientIp(), email);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.` };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user?.passwordHash ? await verifyPassword(user.passwordHash, parsed.data.password) : false;

  if (!user || !ok) {
    recordAttempt(key);
    await audit(user?.id ?? null, "auth.login_failed", "User", user?.id ?? email, { email });
    return { error: "Email or password is incorrect." };
  }
  if (user.status === "DISABLED") {
    recordAttempt(key);
    return { error: "This account has been disabled. Contact V ACT." };
  }
  if (user.status === "INVITED") {
    return { error: "Your password has not been set yet. Use the link in your invitation email, or request a new one below." };
  }

  clearAttempts(key);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({ sub: user.id, role: user.role, name: user.name });
  await audit(user.id, "auth.login", "User", user.id, {});

  const next = safeNext(parsed.data.next);
  redirect(next && isAllowedFor(user.role, next) ? next : roleHome(user.role));
}

function isAllowedFor(role: "ADMIN" | "STAFF" | "CLIENT", path: string): boolean {
  if (path.startsWith("/admin")) return role === "ADMIN";
  if (path.startsWith("/staff")) return role === "ADMIN" || role === "STAFF";
  if (path.startsWith("/client")) return role === "CLIENT";
  return true;
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

const setPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string(),
  confirm: z.string(),
});

export async function setPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = setPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: "Check the form." };
  const { token, password, confirm } = parsed.data;
  const problem = passwordProblems(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: "The two passwords do not match." };

  const user = await prisma.user.findUnique({ where: { inviteToken: hashToken(token) } });
  if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
    return { error: "This link has expired or was already used. Ask V ACT to resend it, or use Forgot password." };
  }
  if (user.status === "DISABLED") return { error: "This account has been disabled. Contact V ACT." };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      status: "ACTIVE",
      inviteToken: null,
      inviteExpiresAt: null,
      lastLoginAt: new Date(),
    },
  });
  await audit(user.id, "auth.password_set", "User", user.id, {});
  await createSession({ sub: user.id, role: user.role, name: user.name });
  redirect(roleHome(user.role));
}

const forgotSchema = z.object({ email: z.string().trim().email("Enter a valid email address.") });

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const email = parsed.data.email.toLowerCase();
  const key = rateLimitKey("forgot", await clientIp(), email);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.` };
  }
  recordAttempt(key);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.status !== "DISABLED") {
    const { raw, hash } = generateToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { inviteToken: hash, inviteExpiresAt: inviteExpiry() },
    });
    await sendInvite(user, raw, { isReset: true });
  }
  return { success: "If an account exists for that email, a link to choose a new password has been sent." };
}

const changePasswordSchema = z.object({
  current: z.string().min(1, "Enter your current password."),
  password: z.string(),
  confirm: z.string(),
});

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const problem = passwordProblems(parsed.data.password);
  if (problem) return { error: problem };
  if (parsed.data.password !== parsed.data.confirm) return { error: "The two passwords do not match." };
  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, parsed.data.current))) {
    return { error: "Your current password is incorrect." };
  }
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  await audit(me.id, "auth.password_set", "User", me.id, { changed: true });
  return { success: "Password updated." };
}
