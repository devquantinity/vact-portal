import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, roleHome } from "@/lib/auth/require";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const user = await getSessionUser();
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  if (user) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : roleHome(user.role));

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
        <p className="text-muted-foreground text-sm">
          Use the email and password set up for you by V ACT.
        </p>
      </div>
      <LoginForm next={next} />
      <p className="text-xs text-muted-foreground">
        New here? Your V ACT officer sends an invitation link to set your password. If it has expired, use Forgot
        password to get a new one.
      </p>
    </div>
  );
}
