import Link from "next/link";
import { UserMenu } from "./user-menu";
import { Logo } from "@/components/shared/logo";
import { FIRM } from "@/emails/layout";

export function ClientShell({
  user,
  brandName,
  children,
}: {
  user: { name: string; email: string; role: "CLIENT" | "ADMIN" | "STAFF" };
  brandName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 bg-navy text-white">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/client" className="flex items-center gap-3">
            <Logo />
            <span className="hidden sm:inline text-sm font-semibold">{brandName}</span>
          </Link>
          <UserMenu user={user} variant="light" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="border-t bg-card">
        <div className="mx-auto w-full max-w-4xl px-4 py-5 text-xs text-muted-foreground sm:px-6 space-y-1">
          <p className="font-medium text-foreground">{FIRM.name}</p>
          <p>
            Questions about a request? Call {FIRM.phone} or WhatsApp {FIRM.whatsapp}.
          </p>
        </div>
      </footer>
    </div>
  );
}
