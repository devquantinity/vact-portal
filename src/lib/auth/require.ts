import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma, type Role } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
};

export class AuthError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
  }
}

export function roleHome(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "STAFF":
      return "/staff";
    case "CLIENT":
      return "/client";
  }
}

/**
 * Loads the signed-in user from the session cookie and the database.
 * Returns null when there is no valid session or the account is no longer active.
 * Cached per request so layouts and pages share one lookup.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, email: true, phone: true, role: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
});

/** For pages and server actions: redirects to /login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * For pages and server actions: redirects to /login when signed out and to the user's own
 * home when they do not hold one of the allowed roles.
 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (roles.length > 0 && !roles.includes(user.role)) redirect(roleHome(user.role));
  return user;
}

/** For route handlers: throws AuthError (401/403) instead of redirecting. */
export async function requireApiRole(...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "Sign in required");
  if (roles.length > 0 && !roles.includes(user.role)) throw new AuthError(403, "Not allowed");
  return user;
}

/** True when the user may see the given company. Staff and admin see every company. */
export async function canAccessCompany(user: SessionUser, companyId: string): Promise<boolean> {
  if (user.role !== "CLIENT") return true;
  const link = await prisma.companyContact.findUnique({
    where: { companyId_userId: { companyId, userId: user.id } },
    select: { companyId: true },
  });
  return !!link;
}

export async function requireCompanyAccess(user: SessionUser, companyId: string): Promise<void> {
  if (!(await canAccessCompany(user, companyId))) throw new AuthError(403, "Not allowed");
}

/** Company ids a client user is linked to. */
export async function clientCompanyIds(userId: string): Promise<string[]> {
  const links = await prisma.companyContact.findMany({ where: { userId }, select: { companyId: true } });
  return links.map((l) => l.companyId);
}
