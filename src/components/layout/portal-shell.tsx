"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import type { Role } from "@/lib/db";
import { navFor } from "./nav-config";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";

type User = { name: string; email: string; role: Role };

function Brand({ brandName }: { brandName: string }) {
  return (
    <Link href="/" className="flex items-center gap-3 px-5">
      <Logo />
      <span className="text-sm font-semibold text-white leading-tight">{brandName}</span>
    </Link>
  );
}

export function PortalShell({ user, brandName, children }: { user: User; brandName: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const groups = navFor(user.role);

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="py-5">
        <Brand brandName={brandName} />
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav groups={groups} onNavigate={() => setOpen(false)} />
      </div>
      <div className="border-t border-sidebar-border p-2">
        <UserMenu user={user} />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col fixed inset-y-0 left-0 z-30">{sidebar}</aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
        <header className="lg:hidden sticky top-0 z-20 flex h-14 items-center gap-3 bg-sidebar px-3 text-white">
          <Sheet open={open} onOpenChange={setOpen}>
            <Button variant="ghost" size="icon" className="text-white hover:bg-sidebar-accent hover:text-white" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu />
            </Button>
            <SheetContent side="left" className="w-72 p-0 border-sidebar-border [&>button]:text-white">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
          <Brand brandName={brandName} />
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
