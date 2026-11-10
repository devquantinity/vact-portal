import { daysLeft, describeDaysLeft, formatDueDate } from "@/lib/dates";
import { FIRM_NAME } from "@/lib/env";
import type { AppSettings } from "@/lib/settings";
import type { TemplateVars } from "./render";

export type RequestForTemplate = {
  id: string;
  dueDate: Date;
  company: { name: string };
  documentType: { name: string };
};

export type StaffForTemplate = { name: string; phone: string | null } | null | undefined;

/** The placeholder values for one recipient of one request. */
export function buildTemplateVars(params: {
  request: RequestForTemplate;
  contactName: string;
  staff: StaffForTemplate;
  settings: AppSettings;
  link: string;
  now?: Date;
}): TemplateVars {
  const { request, contactName, staff, settings, link } = params;
  const now = params.now ?? new Date();
  return {
    client_name: contactName,
    company: request.company.name,
    document: request.documentType.name,
    due_date: formatDueDate(request.dueDate),
    days_left: describeDaysLeft(daysLeft(request.dueDate, now)),
    link,
    staff_name: staff?.name ?? "your V ACT officer",
    // Clients are given the office line, not an officer's own mobile.
    staff_phone: settings.staffPhone,
    firm: FIRM_NAME,
  };
}
