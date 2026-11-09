import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/require";
import { formatPhone } from "@/lib/phone";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ReminderTypeEditor, type ReminderTypeValues } from "@/components/admin/reminder-type-editor";
import { DeleteReminderTypeButton } from "@/components/admin/delete-reminder-type-button";

export async function generateMetadata(props: PageProps<"/admin/reminder-types/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (id === "new") return { title: "New reminder type" };
  const rt = await prisma.reminderType.findUnique({ where: { id }, select: { name: true } });
  return { title: rt?.name ?? "Reminder type" };
}

const BLANK: ReminderTypeValues = {
  id: null,
  name: "",
  description: "",
  channel: "BOTH",
  daysBefore: [7, 1],
  repeatEveryDays: 3,
  escalateAfter: 3,
  whatsappBody: "{document} for {company} is due on {due_date} ({days_left}). Please upload it through the portal.",
  emailSubject: "Reminder: {document} for {company} due {due_date}",
  emailBody:
    "Dear {client_name},\n\nWe are still waiting for the {document} for {company}, due {due_date} ({days_left}).\n\nPlease upload it through the portal using the button below. Reminders stop automatically once it is received.\n\nThank you,\n{staff_name}\n{firm}",
  active: true,
};

export default async function ReminderTypeEditorPage(props: PageProps<"/admin/reminder-types/[id]">) {
  const admin = await requireRole("ADMIN");
  const { id } = await props.params;
  let initial = BLANK;
  let usage = 0;
  if (id !== "new") {
    const rt = await prisma.reminderType.findUnique({ where: { id }, include: { _count: { select: { requests: true } } } });
    if (!rt) notFound();
    usage = rt._count.requests;
    initial = {
      id: rt.id,
      name: rt.name,
      description: rt.description ?? "",
      channel: rt.channel,
      daysBefore: rt.daysBefore,
      repeatEveryDays: rt.repeatEveryDays,
      escalateAfter: rt.escalateAfter,
      whatsappBody: rt.whatsappBody,
      emailSubject: rt.emailSubject,
      emailBody: rt.emailBody,
      active: rt.active,
    };
  }
  return (
    <>
      <PageHeader
        title={initial.id ? initial.name : "New reminder type"}
        description={initial.id ? `Used by ${usage} request${usage === 1 ? "" : "s"}. Changes apply to reminders sent from now on.` : "Define when and how clients are chased for this kind of document."}
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/admin/reminder-types">
                <ArrowLeft /> All reminder types
              </Link>
            </Button>
            {initial.id ? <DeleteReminderTypeButton id={initial.id} disabled={usage > 0} /> : null}
          </>
        }
      />
      <ReminderTypeEditor
        key={id}
        initial={initial}
        adminContact={{ email: admin.email, phone: admin.phone ? formatPhone(admin.phone) : null }}
      />
    </>
  );
}
