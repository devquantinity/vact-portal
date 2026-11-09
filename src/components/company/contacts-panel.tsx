"use client";

import { useActionState, useState, useTransition } from "react";
import { MoreHorizontal, Star, UserPlus, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addExistingContactAction,
  createContactAction,
  removeContactAction,
  setPrimaryContactAction,
} from "@/actions/companies";
import type { ActionState } from "@/lib/action-utils";
import { formatPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, NativeSelect } from "@/components/forms/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { EmptyState } from "@/components/shared/empty-state";
import { UserStatusBadge } from "@/components/shared/status-badge";
import type { UserStatus } from "@/lib/db";

export type ContactRow = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  isPrimary: boolean;
  otherCompanies: string[];
};

export type ClientOption = { id: string; name: string; email: string };

export function ContactsPanel({
  companyId,
  contacts,
  availableClients,
  canManage,
}: {
  companyId: string;
  contacts: ContactRow[];
  availableClients: ClientOption[];
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <NewContactDialog companyId={companyId} />
          <LinkExistingDialog companyId={companyId} clients={availableClients} />
        </div>
      ) : null}
      {contacts.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No contacts yet"
          description="Add the director or finance person who will receive reminders and upload documents."
          compact
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Account</TableHead>
                {canManage ? <TableHead className="w-10" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.userId}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      {c.name}
                      {c.isPrimary ? (
                        <Badge variant="info">
                          <Star className="size-3" /> Primary
                        </Badge>
                      ) : null}
                    </div>
                    {c.otherCompanies.length ? (
                      <p className="text-xs text-muted-foreground">Also: {c.otherCompanies.join(", ")}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.email}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ? formatPhone(c.phone) : "—"}</TableCell>
                  <TableCell>
                    <UserStatusBadge status={c.status} />
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Contact actions" disabled={pending}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!c.isPrimary ? (
                            <DropdownMenuItem
                              onSelect={() =>
                                startTransition(async () => {
                                  await setPrimaryContactAction(companyId, c.userId);
                                  toast.success(`${c.name} is now the primary contact.`);
                                })
                              }
                            >
                              <Star /> Make primary
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() =>
                              startTransition(async () => {
                                await removeContactAction(companyId, c.userId);
                                toast.success(`${c.name} unlinked from this company.`);
                              })
                            }
                          >
                            <Trash2 /> Unlink from company
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function NewContactDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const bound = createContactAction.bind(null, companyId);
  const [state, action] = useActionState<ActionState, FormData>(bound, null);
  const errors = (!state?.ok && state?.fieldErrors) || {};
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> New contact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New client contact</DialogTitle>
          <DialogDescription>
            Creates a client login and sends the set-password link by email, and by WhatsApp when a number is given.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <Field label="Full name" htmlFor="c-name" error={errors.name}>
            <Input id="c-name" name="name" required placeholder="e.g. Hafiz bin Rahman" />
          </Field>
          <Field label="Email" htmlFor="c-email" error={errors.email}>
            <Input id="c-email" name="email" type="email" required placeholder="director@company.com" />
          </Field>
          <Field label="WhatsApp number" htmlFor="c-phone" error={errors.phone} hint="Malaysian numbers can be typed as 012-345 6789.">
            <Input id="c-phone" name="phone" inputMode="tel" placeholder="012-345 6789" />
          </Field>
          <ActionFeedback state={state} onSuccess={() => setOpen(false)} />
          <div className="flex justify-end">
            <SubmitButton pendingText="Creating…">Create and invite</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LinkExistingDialog({ companyId, clients }: { companyId: string; clients: ClientOption[] }) {
  const [open, setOpen] = useState(false);
  const bound = addExistingContactAction.bind(null, companyId);
  const [state, action] = useActionState<ActionState, FormData>(bound, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Link2 /> Link existing client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link an existing client</DialogTitle>
          <DialogDescription>For directors who already have a login for another company.</DialogDescription>
        </DialogHeader>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every client account is already linked to this company.</p>
        ) : (
          <form action={action} className="space-y-4">
            <Field label="Client" htmlFor="userId">
              <NativeSelect id="userId" name="userId" required defaultValue="">
                <option value="" disabled>
                  Choose a client…
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.email}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <ActionFeedback state={state} onSuccess={() => setOpen(false)} />
            <div className="flex justify-end">
              <SubmitButton pendingText="Linking…">Link client</SubmitButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
