"use client";

import { useActionState, useState, useTransition } from "react";
import { MoreHorizontal, Plus, Send, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { createUserAction, resendInviteAction, setUserDisabledAction } from "@/actions/users";
import type { ActionState } from "@/lib/action-utils";
import { formatPhone } from "@/lib/phone";
import type { Role, UserStatus } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, NativeSelect } from "@/components/forms/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { EmptyState } from "@/components/shared/empty-state";
import { UserStatusBadge } from "@/components/shared/status-badge";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  lastLoginAt: string | null;
  companies: { id: string; name: string }[];
};

export function UsersTable({ users, kind, meId }: { users: UserRow[]; kind: "staff" | "clients"; meId: string }) {
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<ActionState>) {
    startTransition(async () => {
      const res = await fn();
      if (!res) return;
      if (res.ok) toast.success(res.message ?? "Done");
      else toast.error(res.error);
    });
  }

  if (users.length === 0) {
    return (
      <EmptyState
        title={kind === "staff" ? "No staff accounts" : "No client accounts yet"}
        description={kind === "staff" ? "Add the V ACT team so they can review uploads and receive escalations." : "Clients are usually added from the company page, so they are linked from day one."}
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            {kind === "clients" ? <TableHead>Companies</TableHead> : <TableHead>Role</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Last sign-in</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell className="text-muted-foreground">{u.email}</TableCell>
              <TableCell className="text-muted-foreground">{u.phone ? formatPhone(u.phone) : "—"}</TableCell>
              {kind === "clients" ? (
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.companies.length === 0 ? <span className="text-muted-foreground text-sm">Not linked</span> : null}
                    {u.companies.map((c) => (
                      <Badge key={c.id} variant="secondary" asChild>
                        <a href={`/admin/companies/${c.id}`}>{c.name}</a>
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              ) : (
                <TableCell>{u.role === "ADMIN" ? "Administrator" : "Staff"}</TableCell>
              )}
              <TableCell>
                <UserStatusBadge status={u.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{u.lastLoginAt ?? "Never"}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="User actions" disabled={pending}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => run(() => resendInviteAction(u.id))} disabled={u.status === "DISABLED"}>
                      <Send /> {u.status === "ACTIVE" ? "Send password reset" : "Resend invite"}
                    </DropdownMenuItem>
                    {u.status === "DISABLED" ? (
                      <DropdownMenuItem onSelect={() => run(() => setUserDisabledAction(u.id, false))}>
                        <UserCheck /> Enable account
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem variant="destructive" disabled={u.id === meId} onSelect={() => run(() => setUserDisabledAction(u.id, true))}>
                        <UserX /> Disable account
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function NewUserDialog({ defaultRole, companies }: { defaultRole: "STAFF" | "CLIENT"; companies: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>(defaultRole);
  const [state, action] = useActionState<ActionState, FormData>(createUserAction, null);
  const errors = (!state?.ok && state?.fieldErrors) || {};
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setRole(defaultRole);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus /> {defaultRole === "CLIENT" ? "New client" : "New staff"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role === "CLIENT" ? "New client user" : "New team member"}</DialogTitle>
          <DialogDescription>
            An invitation with a set-password link (valid 48 hours) is sent by email
            {role === "CLIENT" ? " and WhatsApp" : ""}.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <Field label="Role" htmlFor="role" error={errors.role}>
            <NativeSelect id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Administrator</option>
              <option value="CLIENT">Client</option>
            </NativeSelect>
          </Field>
          <Field label="Full name" htmlFor="u-name" error={errors.name}>
            <Input id="u-name" name="name" required />
          </Field>
          <Field label="Email" htmlFor="u-email" error={errors.email}>
            <Input id="u-email" name="email" type="email" required />
          </Field>
          <Field label={role === "CLIENT" ? "WhatsApp number" : "Phone (optional)"} htmlFor="u-phone" error={errors.phone} hint="Malaysian numbers can be typed as 012-345 6789.">
            <Input id="u-phone" name="phone" inputMode="tel" placeholder="012-345 6789" required={role === "CLIENT"} />
          </Field>
          {role === "CLIENT" ? (
            <Field label="Link to company" htmlFor="companyId" error={errors.companyId} hint="More companies can be linked from each company's Contacts tab.">
              <NativeSelect id="companyId" name="companyId" defaultValue="">
                <option value="">Not linked yet</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <ActionFeedback state={state} onSuccess={() => setOpen(false)} />
          <div className="flex justify-end">
            <SubmitButton pendingText="Creating…">Create and send invite</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
