"use client";

import { LogOut, UserRound } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { initials } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABEL: Record<string, string> = { ADMIN: "Administrator", STAFF: "Staff", CLIENT: "Client" };

export function UserMenu({
  user,
  variant = "dark",
}: {
  user: { name: string; email: string; role: string };
  variant?: "dark" | "light";
}) {
  const dark = variant === "dark";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          dark
            ? "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-sidebar-accent transition-colors outline-none cursor-pointer"
            : "flex items-center gap-2 rounded-full border bg-card px-2 py-1 text-left hover:bg-accent transition-colors outline-none cursor-pointer"
        }
      >
        <span
          className={
            dark
              ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white"
              : "flex size-7 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-white"
          }
        >
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className={dark ? "block truncate text-sm font-medium text-white" : "block truncate text-sm font-medium text-foreground max-w-[140px]"}>
            {user.name}
          </span>
          {dark ? <span className="block truncate text-xs text-sidebar-muted">{ROLE_LABEL[user.role] ?? user.role}</span> : null}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === "CLIENT" ? (
          <DropdownMenuItem asChild>
            <a href="/client/profile">
              <UserRound /> My profile
            </a>
          </DropdownMenuItem>
        ) : null}
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut /> Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
