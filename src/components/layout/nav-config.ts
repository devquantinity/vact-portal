import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Building2,
  ClipboardCheck,
  FilePlus2,
  FileStack,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Users,
} from "lucide-react";
import type { Role } from "@/lib/db";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };

export function navFor(role: Role): NavGroup[] {
  if (role === "ADMIN") {
    return [
      { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
      {
        label: "Work",
        items: [
          { href: "/staff/requests/new", label: "New request", icon: FilePlus2 },
          { href: "/staff/reviews", label: "Review queue", icon: ClipboardCheck },
        ],
      },
      {
        label: "Manage",
        items: [
          { href: "/admin/companies", label: "Companies", icon: Building2 },
          { href: "/admin/users", label: "Users", icon: Users },
          { href: "/admin/document-types", label: "Document types", icon: FileStack },
          { href: "/admin/reminder-types", label: "Reminder types", icon: Bell },
        ],
      },
      {
        label: "System",
        items: [
          { href: "/admin/messages", label: "Delivery log", icon: MessagesSquare },
          { href: "/admin/settings", label: "Settings", icon: Settings },
          { href: "/admin/audit", label: "Audit log", icon: Activity },
        ],
      },
    ];
  }
  return [
    { items: [{ href: "/staff", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
    {
      label: "Work",
      items: [
        { href: "/staff/requests/new", label: "New request", icon: FilePlus2 },
        { href: "/staff/reviews", label: "Review queue", icon: ClipboardCheck },
        { href: "/staff/companies", label: "Companies", icon: Building2 },
      ],
    },
  ];
}
