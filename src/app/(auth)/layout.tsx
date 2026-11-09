import { Logo } from "@/components/shared/logo";
import { FIRM_NAME } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="bg-navy text-white flex flex-col justify-between px-8 py-8 lg:px-14 lg:py-14">
        <div className="flex items-center gap-3">
          <Logo className="px-2.5 py-2" imgClassName="h-8" />
        </div>
        <div className="hidden lg:block space-y-5 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Documents in, reminders out, nothing slips past the deadline.
          </h1>
          <p className="text-sidebar-foreground/80 text-base leading-relaxed">
            Upload what V ACT needs for your company, see exactly what is still missing, and let the portal keep
            everyone on time with WhatsApp and email reminders that stop the moment you comply.
          </p>
          <ul className="text-sm text-sidebar-foreground/80 space-y-2">
            <li className="flex gap-2"><span className="text-brand">●</span> Secure login for every director and contact</li>
            <li className="flex gap-2"><span className="text-brand">●</span> Every message logged as sent, delivered and read</li>
            <li className="flex gap-2"><span className="text-brand">●</span> Staff review with clear approvals and comments</li>
          </ul>
        </div>
        <p className="text-xs text-sidebar-muted mt-6 lg:mt-0">{FIRM_NAME}</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
