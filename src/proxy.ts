import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/jwt";

const PUBLIC_PREFIXES = ["/login", "/set-password", "/forgot-password", "/api/webhooks", "/api/health", "/api/cron", "/logo.png"];

function homeFor(role: string) {
  return role === "ADMIN" ? "/admin" : role === "STAFF" ? "/staff" : "/client";
}

/**
 * First line of defence: unauthenticated visitors are sent to /login (with ?next=), and signed-in users
 * cannot open another role's area. Every page and action still checks the session itself (requireRole).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET ?? "";
  const session = token && secret ? await verifySessionToken(token, secret) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  const role = session.role;
  const wrongArea =
    (pathname.startsWith("/admin") && role !== "ADMIN") ||
    (pathname.startsWith("/staff") && role === "CLIENT") ||
    (pathname.startsWith("/client") && role !== "CLIENT");
  if (wrongArea) {
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp|woff2?)$).*)"],
};
