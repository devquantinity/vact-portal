import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Set your password" };

export default async function SetPasswordPage(props: PageProps<"/set-password/[token]">) {
  const { token } = await props.params;
  const user = await prisma.user.findUnique({
    where: { inviteToken: hashToken(token) },
    select: { name: true, email: true, inviteExpiresAt: true, status: true },
  });
  const valid = user && user.inviteExpiresAt && user.inviteExpiresAt > new Date() && user.status !== "DISABLED";

  if (!valid) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">This link is no longer valid</h2>
          <p className="text-muted-foreground text-sm">
            Set-password links work for 48 hours and can only be used once. Request a new one and we will email it to
            you right away.
          </p>
        </div>
        <Button asChild size="lg" className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
        <p className="text-sm text-center">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome, {user.name.split(" ")[0]}</h2>
        <p className="text-muted-foreground text-sm">
          Choose a password for <span className="font-medium text-foreground">{user.email}</span>. You will be signed in
          straight after.
        </p>
      </div>
      <SetPasswordForm token={token} />
    </div>
  );
}
