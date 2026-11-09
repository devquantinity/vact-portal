import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Channel, JobKind, JobStatus, MessageKind, MessageStatus, ReviewStatus, UploaderRole } from "../src/generated/prisma/enums";
import type { Prisma } from "../src/generated/prisma/client";
import { DEFAULT_SETTINGS } from "../src/lib/settings";
import { addDaysToDateString, atMytTime, dateOnlyToDb, daysLeft, describeDaysLeft, formatDueDate, mytDateString, todayMyt } from "../src/lib/dates";
import { channelsFor, generateSchedule, nextRepeatAt } from "../src/lib/reminders/schedule";
import { composeTemplateMessage } from "../src/lib/messaging/whatsapp";
import { renderTemplate } from "../src/lib/templates/render";
import { FIRM_NAME } from "../src/lib/env";
import { formatPhone } from "../src/lib/phone";
import { DEMO_PASSWORD, DOCUMENT_TYPES, REMINDER_TYPES } from "./seed-data";
import { sampleJpg, samplePdf } from "./seed-files";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const NOW = new Date();
const TODAY = todayMyt(NOW);
const day = (offset: number) => addDaysToDateString(TODAY, offset);
const at = (offset: number, time = "09:00") => atMytTime(day(offset), time);
const minutesAfter = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads");
const DEMO_PHONE = process.env.SEED_DEMO_PHONE || "+60123456789";
const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL || "client@vact.demo";

// ---------------------------------------------------------------------------------------------
// Static definitions
// ---------------------------------------------------------------------------------------------

type CompanyDef = {
  key: string;
  name: string;
  ssm: string;
  inc: string;
  fye: string;
  staff: "aisyah" | "daniel";
  contact: { key: string; name: string; email: string; phone: string };
  notes?: string;
};

const COMPANIES: CompanyDef[] = [
  { key: "hafiz", name: "Hafiz Trading Sdn Bhd", ssm: "202301012345 (1512345-X)", inc: "2023-03-15", fye: "12-31", staff: "aisyah", contact: { key: "hafiz", name: "Hafiz bin Rahman", email: "client@vact.demo", phone: DEMO_PHONE }, notes: "Director prefers WhatsApp in the morning. Audit by Tan & Co." },
  { key: "nusantara", name: "Nusantara Agro Resources Sdn Bhd", ssm: "201901023456 (1323456-K)", inc: "2019-06-02", fye: "06-30", staff: "aisyah", contact: { key: "farah", name: "Farah Nadia binti Zulkifli", email: "finance@nusantara-agro.demo", phone: "+60123100002" } },
  { key: "kedai", name: "Kedai Kopi Warisan Sdn Bhd", ssm: "202101034567 (1412345-P)", inc: "2021-01-18", fye: "12-31", staff: "aisyah", contact: { key: "wong", name: "Wong Siew Mei", email: "siewmei@warisankopi.demo", phone: "+60123100003" } },
  { key: "bayu", name: "Bayu Logistik Sdn Bhd", ssm: "201801045678 (1289012-T)", inc: "2018-09-30", fye: "09-30", staff: "aisyah", contact: { key: "azman", name: "Azman bin Yusof", email: "azman@bayulogistik.demo", phone: "+60123100004" } },
  { key: "seri", name: "Seri Mutiara Properties Sdn Bhd", ssm: "202201056789 (1467890-W)", inc: "2022-04-11", fye: "03-31", staff: "aisyah", contact: { key: "priya", name: "Priya Letchumanan", email: "priya@serimutiara.demo", phone: "+60123100005" } },
  { key: "technova", name: "TechNova Solutions Sdn Bhd", ssm: "202001067890 (1378901-H)", inc: "2020-11-23", fye: "12-31", staff: "daniel", contact: { key: "kevin", name: "Kevin Cheah Wei Lun", email: "kevin@technova.demo", phone: "+60123100006" } },
  { key: "limtan", name: "Lim & Tan Engineering Sdn Bhd", ssm: "201501078901 (1156789-A)", inc: "2015-02-05", fye: "06-30", staff: "daniel", contact: { key: "jessica", name: "Jessica Tan Li Ying", email: "accounts@limtan-eng.demo", phone: "+60123100007" } },
  { key: "puncak", name: "Puncak Hijau Landscaping Sdn Bhd", ssm: "202301089012 (1523456-D)", inc: "2023-08-21", fye: "12-31", staff: "daniel", contact: { key: "syafiq", name: "Muhammad Syafiq bin Osman", email: "syafiq@puncakhijau.demo", phone: "+60100000000" }, notes: "WhatsApp number bounced on the last reminder; call the office line instead." },
  { key: "delima", name: "Delima Fashion House Sdn Bhd", ssm: "201701090123 (1245678-M)", inc: "2017-05-09", fye: "12-31", staff: "daniel", contact: { key: "aina", name: "Nur Aina binti Kamarul", email: "aina@delimafashion.demo", phone: "+60123100009" } },
  { key: "borneo", name: "Borneo Harvest Foods Sdn Bhd", ssm: "202201001234 (1456789-V)", inc: "2022-10-03", fye: "12-31", staff: "daniel", contact: { key: "jonathan", name: "Jonathan Anak Juing", email: "jonathan@borneoharvest.demo", phone: "+60123100010" } },
];

/** A director with two Sdn Bhds (linked to Nusantara and Seri Mutiara). */
const DIRECTOR = { key: "rosli", name: "Dato' Rosli bin Hamid", email: "rosli@hamidholdings.demo", phone: "+60123100011", companies: ["nusantara", "seri"] };

type FileDef = { name: string; kind: "pdf" | "jpg"; review: ReviewStatus; comment?: string; by: UploaderRole; uploadedAt: number; reviewedAt?: number };

type RequestDef = {
  id: string;
  company: string;
  docType: string;
  rule: string;
  due: number; // day offset from today
  created: number; // day offset from today (10:00 KL)
  status: "PENDING" | "UPLOADED" | "CHANGES_REQUESTED" | "APPROVED";
  instructions?: string;
  /** PENDING only: adds one job per channel that is due right now (for the "Run reminders now" demo). */
  dueNow?: boolean;
  /** Closed requests: when the upload happened (day offset). */
  uploadedAt?: number;
  files?: FileDef[];
  /** Index (1-based) of the SENT moment whose WhatsApp failed with an invalid number. */
  failWhatsAppAt?: number;
};

const REQUESTS: RequestDef[] = [
  // --- PENDING, future ---------------------------------------------------------------------
  { id: "seed-req-01", company: "hafiz", docType: "Management accounts", rule: "Document request (standard)", due: 3, created: -4, status: "PENDING", dueNow: true, instructions: "Profit and loss plus balance sheet for Jan to Sep 2026, exported from your accounting system." },
  { id: "seed-req-02", company: "technova", docType: "Audited financial statements", rule: "Audited accounts", due: 6, created: -70, status: "PENDING" },
  { id: "seed-req-03", company: "kedai", docType: "Director's resolution (signed)", rule: "Document request (standard)", due: 10, created: -2, status: "PENDING", instructions: "Resolution to open the new Maybank account. All three directors must sign." },
  { id: "seed-req-04", company: "bayu", docType: "Bank statements", rule: "Peringatan dokumen (BM)", due: 14, created: -1, status: "PENDING", instructions: "Penyata bank Jul hingga Sep 2026." },
  { id: "seed-req-05", company: "limtan", docType: "Annual return information (Section 68)", rule: "Annual Return (SSM)", due: 21, created: -3, status: "PENDING" },
  { id: "seed-req-06", company: "borneo", docType: "Tax computation / CP204 working", rule: "Document request (standard)", due: 30, created: -1, status: "PENDING" },
  // --- PENDING, overdue, with reminder history ---------------------------------------------
  { id: "seed-req-07", company: "hafiz", docType: "Annual return information (Section 68)", rule: "Document request (standard)", due: -5, created: -15, status: "PENDING", instructions: "Confirm the registered office, directors and shareholders as at the anniversary date." },
  { id: "seed-req-08", company: "seri", docType: "Bank statements", rule: "Annual Return (SSM)", due: -3, created: -8, status: "PENDING" },
  { id: "seed-req-09", company: "puncak", docType: "Payroll summary (Form E)", rule: "Peringatan dokumen (BM)", due: -5, created: -9, status: "PENDING", failWhatsAppAt: 5 },
  { id: "seed-req-10", company: "delima", docType: "Proof of address", rule: "Annual Return (SSM)", due: -4, created: -9, status: "PENDING" },
  { id: "seed-req-11", company: "nusantara", docType: "Audited financial statements", rule: "Audited accounts", due: -20, created: -40, status: "PENDING" },
  // --- UPLOADED, awaiting review -----------------------------------------------------------
  { id: "seed-req-12", company: "hafiz", docType: "NRIC / passport copy of directors", rule: "Document request (standard)", due: 2, created: -10, status: "UPLOADED", uploadedAt: -1, files: [{ name: "nric-hafiz-front-back.jpg", kind: "jpg", review: "AWAITING", by: "CLIENT", uploadedAt: -1 }] },
  { id: "seed-req-13", company: "technova", docType: "Bank statements", rule: "Document request (standard)", due: -1, created: -12, status: "UPLOADED", uploadedAt: 0, files: [{ name: "maybank-statement-sep-2026.pdf", kind: "pdf", review: "AWAITING", by: "CLIENT", uploadedAt: 0 }, { name: "maybank-statement-oct-2026.pdf", kind: "pdf", review: "AWAITING", by: "CLIENT", uploadedAt: 0 }] },
  { id: "seed-req-14", company: "kedai", docType: "Management accounts", rule: "Document request (standard)", due: 5, created: -6, status: "UPLOADED", uploadedAt: -1, files: [{ name: "management-accounts-q3-2026.pdf", kind: "pdf", review: "AWAITING", by: "STAFF", uploadedAt: -1 }] },
  { id: "seed-req-15", company: "bayu", docType: "Director's resolution (signed)", rule: "Document request (standard)", due: 1, created: -9, status: "UPLOADED", uploadedAt: -2, files: [{ name: "resolution-signed.pdf", kind: "pdf", review: "AWAITING", by: "CLIENT", uploadedAt: -2 }] },
  { id: "seed-req-16", company: "limtan", docType: "Share transfer instrument (Section 105)", rule: "Document request (standard)", due: 7, created: -5, status: "UPLOADED", uploadedAt: 0, files: [{ name: "form-32a-stamped.pdf", kind: "pdf", review: "AWAITING", by: "CLIENT", uploadedAt: 0 }] },
  // --- CHANGES_REQUESTED -------------------------------------------------------------------
  { id: "seed-req-17", company: "hafiz", docType: "Proof of address", rule: "Document request (standard)", due: -2, created: -14, status: "CHANGES_REQUESTED", uploadedAt: -3, files: [{ name: "tnb-bill-march.pdf", kind: "pdf", review: "CHANGES_REQUESTED", comment: "This bill is dated March 2026. SSM needs one from the last 3 months; a bank statement works too.", by: "CLIENT", uploadedAt: -3, reviewedAt: -2 }] },
  { id: "seed-req-18", company: "borneo", docType: "Payroll summary (Form E)", rule: "Document request (standard)", due: 4, created: -12, status: "CHANGES_REQUESTED", uploadedAt: -4, files: [{ name: "payroll-2025.xlsx.pdf", kind: "pdf", review: "CHANGES_REQUESTED", comment: "The summary has no company name or year in the header and the totals do not match the EA forms. Please export the final version from your payroll system.", by: "CLIENT", uploadedAt: -4, reviewedAt: -3 }] },
  { id: "seed-req-19", company: "puncak", docType: "Director's resolution (signed)", rule: "Document request (standard)", due: -6, created: -16, status: "CHANGES_REQUESTED", uploadedAt: -7, files: [{ name: "resolution-scan.pdf", kind: "pdf", review: "CHANGES_REQUESTED", comment: "Page 3 is missing the second director's signature. Please sign and re-scan all pages into one PDF.", by: "CLIENT", uploadedAt: -7, reviewedAt: -6 }] },
  // --- APPROVED ----------------------------------------------------------------------------
  { id: "seed-req-20", company: "hafiz", docType: "Bank statements", rule: "Document request (standard)", due: -15, created: -30, status: "APPROVED", uploadedAt: -8, files: [{ name: "cimb-statements-jul-sep-2026.pdf", kind: "pdf", review: "APPROVED", by: "CLIENT", uploadedAt: -8, reviewedAt: -7 }] },
  { id: "seed-req-21", company: "hafiz", docType: "Audited financial statements", rule: "Audited accounts", due: -40, created: -110, status: "APPROVED", uploadedAt: -42, files: [{ name: "audited-accounts-fy2025-draft.pdf", kind: "pdf", review: "CHANGES_REQUESTED", comment: "This is the unsigned draft. We need the signed set with the auditor's report.", by: "CLIENT", uploadedAt: -48, reviewedAt: -47 }, { name: "audited-accounts-fy2025-signed.pdf", kind: "pdf", review: "APPROVED", by: "CLIENT", uploadedAt: -42, reviewedAt: -41 }] },
  { id: "seed-req-22", company: "nusantara", docType: "Annual return information (Section 68)", rule: "Annual Return (SSM)", due: -30, created: -60, status: "APPROVED", uploadedAt: -33, files: [{ name: "annual-return-info-2026.pdf", kind: "pdf", review: "APPROVED", by: "STAFF", uploadedAt: -33, reviewedAt: -33 }] },
  { id: "seed-req-23", company: "seri", docType: "NRIC / passport copy of directors", rule: "Document request (standard)", due: -25, created: -35, status: "APPROVED", uploadedAt: -27, files: [{ name: "directors-nric.pdf", kind: "pdf", review: "APPROVED", by: "CLIENT", uploadedAt: -27, reviewedAt: -26 }] },
  { id: "seed-req-24", company: "delima", docType: "Tax computation / CP204 working", rule: "Document request (standard)", due: -18, created: -32, status: "APPROVED", uploadedAt: -19, files: [{ name: "cp204-working-v1.pdf", kind: "pdf", review: "CHANGES_REQUESTED", comment: "Capital allowance schedule is missing. Please include it.", by: "CLIENT", uploadedAt: -22, reviewedAt: -21 }, { name: "cp204-working-v2.pdf", kind: "pdf", review: "APPROVED", by: "CLIENT", uploadedAt: -19, reviewedAt: -18 }] },
  { id: "seed-req-25", company: "limtan", docType: "Management accounts", rule: "Document request (standard)", due: -10, created: -24, status: "APPROVED", uploadedAt: -6, files: [{ name: "management-accounts-jan-sep-2026.pdf", kind: "pdf", review: "APPROVED", by: "CLIENT", uploadedAt: -6, reviewedAt: -5 }] },
];

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

type Rule = { id: string; name: string; channel: "WHATSAPP" | "EMAIL" | "BOTH"; daysBefore: number[]; repeatEveryDays: number | null; escalateAfter: number | null; whatsappBody: string; emailSubject: string; emailBody: string };
type Contact = { id: string; name: string; email: string; notificationEmail: string | null; phone: string };
type Staff = { id: string; name: string; email: string; phone: string | null };

const WA_STATUSES: MessageStatus[] = ["READ", "READ", "DELIVERED", "READ", "SENT", "READ", "DELIVERED", "READ"];
const EMAIL_STATUSES: MessageStatus[] = ["DELIVERED", "READ", "DELIVERED", "SENT", "READ", "DELIVERED", "READ", "DELIVERED"];

function statusTimestamps(status: MessageStatus, sentAt: Date) {
  return {
    sentAt,
    deliveredAt: status === "DELIVERED" || status === "READ" ? minutesAfter(sentAt, 1) : null,
    readAt: status === "READ" ? minutesAfter(sentAt, 14) : null,
    failedAt: status === "FAILED" ? minutesAfter(sentAt, 0.2) : null,
  };
}

async function main() {
  const started = Date.now();
  const passwordHash = await hash(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  // --- Settings -------------------------------------------------------------------------------
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  // --- Internal users -------------------------------------------------------------------------
  const internal = {
    admin: await prisma.user.upsert({
      where: { email: "admin@vact.demo" },
      update: { name: "Nurul Hasanah", role: "ADMIN", status: "ACTIVE", passwordHash },
      create: { id: "seed-user-admin", email: "admin@vact.demo", name: "Nurul Hasanah", role: "ADMIN", status: "ACTIVE", passwordHash, phone: "+60122001000", lastLoginAt: at(0, "08:45") },
    }),
    aisyah: await prisma.user.upsert({
      where: { email: "aisyah@vact.demo" },
      update: { name: "Aisyah Rahman", role: "STAFF", status: "ACTIVE", passwordHash },
      create: { id: "seed-user-aisyah", email: "aisyah@vact.demo", name: "Aisyah Rahman", role: "STAFF", status: "ACTIVE", passwordHash, phone: "+60122001001", lastLoginAt: at(0, "09:10") },
    }),
    daniel: await prisma.user.upsert({
      where: { email: "daniel@vact.demo" },
      update: { name: "Daniel Lim", role: "STAFF", status: "ACTIVE", passwordHash },
      create: { id: "seed-user-daniel", email: "daniel@vact.demo", name: "Daniel Lim", role: "STAFF", status: "ACTIVE", passwordHash, phone: "+60122001002", lastLoginAt: at(-1, "17:20") },
    }),
  };
  const staffByKey: Record<"aisyah" | "daniel", Staff> = { aisyah: internal.aisyah, daniel: internal.daniel };

  // --- Document types & reminder types -------------------------------------------------------
  const docTypes = new Map<string, { id: string; name: string; acceptedExtensions: string[]; description: string | null }>();
  for (const [index, dt] of DOCUMENT_TYPES.entries()) {
    const row = await prisma.documentType.upsert({
      where: { name: dt.name },
      update: { description: dt.description, acceptedExtensions: dt.acceptedExtensions, maxSizeMb: dt.maxSizeMb ?? 10, allowMultipleFiles: dt.allowMultipleFiles ?? false, sortOrder: index },
      create: { id: `seed-dt-${index + 1}`, name: dt.name, description: dt.description, acceptedExtensions: dt.acceptedExtensions, maxSizeMb: dt.maxSizeMb ?? 10, allowMultipleFiles: dt.allowMultipleFiles ?? false, active: true, sortOrder: index },
    });
    docTypes.set(dt.name, row);
  }
  const rules = new Map<string, Rule>();
  for (const [index, rt] of REMINDER_TYPES.entries()) {
    const data = { description: rt.description, channel: rt.channel, daysBefore: rt.daysBefore, repeatEveryDays: rt.repeatEveryDays, escalateAfter: rt.escalateAfter, whatsappBody: rt.whatsappBody, emailSubject: rt.emailSubject, emailBody: rt.emailBody, active: true };
    const row = await prisma.reminderType.upsert({ where: { name: rt.name }, update: data, create: { id: `seed-rt-${index + 1}`, name: rt.name, ...data } });
    rules.set(rt.name, row);
  }

  // --- Companies and client contacts ---------------------------------------------------------
  const companies = new Map<string, { id: string; name: string; staff: Staff; contacts: Contact[] }>();
  for (const c of COMPANIES) {
    const staff = staffByKey[c.staff];
    const company = await prisma.company.upsert({
      where: { ssmNumber: c.ssm },
      update: { name: c.name, incorporationDate: dateOnlyToDb(c.inc), financialYearEnd: c.fye, assignedStaffId: staff.id, status: "ACTIVE", notes: c.notes ?? null },
      create: { id: `seed-co-${c.key}`, name: c.name, ssmNumber: c.ssm, incorporationDate: dateOnlyToDb(c.inc), financialYearEnd: c.fye, assignedStaffId: staff.id, status: "ACTIVE", notes: c.notes ?? null },
    });
    const isDemo = c.key === "hafiz";
    const notificationEmail = isDemo && DEMO_EMAIL !== c.contact.email ? DEMO_EMAIL : null;
    const user = await prisma.user.upsert({
      where: { email: c.contact.email },
      update: { name: c.contact.name, phone: c.contact.phone, notificationEmail, role: "CLIENT", status: "ACTIVE", passwordHash },
      create: { id: `seed-user-${c.contact.key}`, email: c.contact.email, name: c.contact.name, phone: c.contact.phone, notificationEmail, role: "CLIENT", status: "ACTIVE", passwordHash, lastLoginAt: isDemo ? at(-1, "20:05") : null },
    });
    await prisma.companyContact.upsert({
      where: { companyId_userId: { companyId: company.id, userId: user.id } },
      update: { isPrimary: true },
      create: { companyId: company.id, userId: user.id, isPrimary: true },
    });
    companies.set(c.key, { id: company.id, name: company.name, staff, contacts: [{ id: user.id, name: user.name, email: user.email, notificationEmail: user.notificationEmail, phone: c.contact.phone }] });
  }
  const director = await prisma.user.upsert({
    where: { email: DIRECTOR.email },
    update: { name: DIRECTOR.name, phone: DIRECTOR.phone, role: "CLIENT", status: "ACTIVE", passwordHash },
    create: { id: `seed-user-${DIRECTOR.key}`, email: DIRECTOR.email, name: DIRECTOR.name, phone: DIRECTOR.phone, role: "CLIENT", status: "ACTIVE", passwordHash },
  });
  for (const key of DIRECTOR.companies) {
    const company = companies.get(key)!;
    await prisma.companyContact.upsert({
      where: { companyId_userId: { companyId: company.id, userId: director.id } },
      update: {},
      create: { companyId: company.id, userId: director.id, isPrimary: false },
    });
    company.contacts.push({ id: director.id, name: director.name, email: director.email, notificationEmail: null, phone: DIRECTOR.phone });
  }

  // --- Requests, jobs, documents, messages, escalations ---------------------------------------
  // Wipe previous seed output for these ids so re-running produces the same picture.
  const requestIds = REQUESTS.map((r) => r.id);
  await prisma.messageLog.deleteMany({ where: { OR: [{ requestId: { in: requestIds } }, { id: { startsWith: "seed-" } }] } });
  await prisma.escalation.deleteMany({ where: { requestId: { in: requestIds } } });
  await prisma.reminderJob.deleteMany({ where: { requestId: { in: requestIds } } });
  await prisma.document.deleteMany({ where: { requestId: { in: requestIds } } });
  await prisma.auditLog.deleteMany({ where: { id: { startsWith: "seed-" } } });

  let messageCount = 0;
  let jobCount = 0;
  let escalationCount = 0;
  let fileCount = 0;

  async function logMessage(params: {
    id: string;
    request: { id: string; companyId: string };
    kind: MessageKind;
    channel: Channel;
    to: Contact | Staff;
    body: string;
    subject?: string;
    status: MessageStatus;
    sentAt: Date;
    jobId?: string;
    error?: { code: string; message: string };
  }) {
    const recipient = params.channel === "WHATSAPP" ? ((params.to as Contact).phone ?? "") : ((params.to as Contact).notificationEmail ?? params.to.email);
    const times = statusTimestamps(params.status, params.sentAt);
    await prisma.messageLog.create({
      data: {
        id: params.id,
        requestId: params.request.id,
        companyId: params.request.companyId,
        userId: params.to.id,
        jobId: params.jobId ?? null,
        kind: params.kind,
        channel: params.channel,
        recipient,
        subject: params.subject ?? null,
        renderedBody: params.body,
        providerMessageId: `sim-seed-${params.id.replace(/^seed-msg-/, "")}`,
        simulated: true,
        status: params.status,
        errorCode: params.error?.code ?? null,
        errorMessage: params.error?.message ?? null,
        queuedAt: minutesAfter(params.sentAt, -0.05),
        ...times,
      },
    });
    messageCount += 1;
  }

  function vars(req: RequestDef, company: { name: string; staff: Staff }, docName: string, contact: Contact, when: Date) {
    const due = dateOnlyToDb(day(req.due));
    return {
      client_name: contact.name,
      company: company.name,
      document: docName,
      due_date: formatDueDate(due),
      days_left: describeDaysLeft(daysLeft(due, when)),
      link: `${APP_URL}/login?next=${encodeURIComponent(`/client/requests/${req.id}`)}`,
      staff_name: company.staff.name,
      staff_phone: company.staff.phone ? formatPhone(company.staff.phone) : DEFAULT_SETTINGS.staffPhone,
      firm: FIRM_NAME,
    };
  }

  for (const req of REQUESTS) {
    const company = companies.get(req.company)!;
    const docType = docTypes.get(req.docType)!;
    const rule = rules.get(req.rule)!;
    const createdAt = at(req.created, "10:00");
    const closedAt = req.status === "APPROVED" ? at(req.files!.at(-1)!.reviewedAt ?? 0, "11:00") : null;

    await prisma.documentRequest.upsert({
      where: { id: req.id },
      update: { companyId: company.id, documentTypeId: docType.id, reminderTypeId: rule.id, dueDate: dateOnlyToDb(day(req.due)), status: req.status, instructions: req.instructions ?? null, createdAt, closedAt },
      create: { id: req.id, companyId: company.id, documentTypeId: docType.id, reminderTypeId: rule.id, dueDate: dateOnlyToDb(day(req.due)), status: req.status, instructions: req.instructions ?? null, createdById: company.staff.id, createdAt, closedAt },
    });
    const request = { id: req.id, companyId: company.id };
    let msgSeq = 0;
    const msgId = () => `seed-msg-${req.id.slice(-2)}-${String(++msgSeq).padStart(2, "0")}`;

    // Job 0: new-request notification on the rule's channels.
    for (const contact of company.contacts) {
      const v = vars(req, company, docType.name, contact, createdAt);
      for (const channel of channelsFor(rule.channel)) {
        if (channel === "WHATSAPP") {
          const body = composeTemplateMessage({ clientName: contact.name, body: renderTemplate(rule.whatsappBody, v).text, link: v.link }).text;
          await logMessage({ id: msgId(), request, kind: "NEW_REQUEST", channel, to: contact, body, status: "READ", sentAt: minutesAfter(createdAt, 1) });
        } else {
          await logMessage({ id: msgId(), request, kind: "NEW_REQUEST", channel, to: contact, body: renderTemplate(rule.emailBody, v).text, subject: renderTemplate(rule.emailSubject, v).text, status: "DELIVERED", sentAt: minutesAfter(createdAt, 1) });
        }
      }
    }

    // Reminder moments: everything the rule would have fired since creation.
    const uploadMoment = req.uploadedAt != null ? at(req.uploadedAt, "15:00") : null;
    const horizon = uploadMoment ?? NOW;
    const planned = generateSchedule(rule, day(req.due), createdAt);
    const moments: { when: Date; kind: JobKind }[] = [];
    for (const p of planned) {
      if (!moments.some((m) => m.when.getTime() === p.scheduledFor.getTime())) moments.push({ when: p.scheduledFor, kind: p.kind });
    }
    // Extend the REPEAT chain up to the horizon.
    if (rule.repeatEveryDays) {
      let last = moments.filter((m) => m.kind === "REPEAT").at(-1)?.when;
      while (last && last.getTime() < horizon.getTime()) {
        const next = nextRepeatAt(last, rule.repeatEveryDays);
        if (next.getTime() >= horizon.getTime()) break;
        moments.push({ when: next, kind: "REPEAT" });
        last = next;
      }
    }

    let sentMoments = 0;
    let escalated = false;
    let jobSeq = 0;
    for (const moment of moments.sort((a, b) => a.when.getTime() - b.when.getTime())) {
      const past = moment.when.getTime() < horizon.getTime();
      const status: JobStatus = past ? "SENT" : req.status === "PENDING" ? "SCHEDULED" : "CANCELLED";
      if (status === "SENT") sentMoments += 1;
      const failHere = status === "SENT" && req.failWhatsAppAt === sentMoments;
      for (const channel of channelsFor(rule.channel)) {
        const jobId = `seed-job-${req.id.slice(-2)}-${String(++jobSeq).padStart(2, "0")}`;
        const jobStatus: JobStatus = failHere && channel === "WHATSAPP" ? "FAILED" : status;
        await prisma.reminderJob.create({
          data: {
            id: jobId,
            requestId: req.id,
            channel,
            kind: moment.kind,
            scheduledFor: moment.when,
            status: jobStatus,
            attempts: status === "SENT" ? 1 : 0,
            sentAt: jobStatus === "SENT" ? minutesAfter(moment.when, 0.3) : null,
            lastError: jobStatus === "FAILED" ? `${formatPhone(company.contacts[0].phone)}: Message undeliverable — Recipient is not a valid WhatsApp user` : null,
            createdAt,
          },
        });
        jobCount += 1;
        if (status !== "SENT") continue;
        for (const [ci, contact] of company.contacts.entries()) {
          const v = vars(req, company, docType.name, contact, moment.when);
          const sentAt = minutesAfter(moment.when, 0.3 + ci * 0.1);
          const spreadIndex = (sentMoments + ci + Number(req.id.slice(-2))) % WA_STATUSES.length;
          if (channel === "WHATSAPP") {
            const body = composeTemplateMessage({ clientName: contact.name, body: renderTemplate(rule.whatsappBody, v).text, link: v.link }).text;
            const failed = failHere && ci === 0;
            await logMessage({
              id: msgId(),
              request,
              kind: "REMINDER",
              channel,
              to: contact,
              body,
              status: failed ? "FAILED" : WA_STATUSES[spreadIndex],
              sentAt,
              jobId,
              error: failed ? { code: "131026", message: "Message undeliverable — Recipient is not a valid WhatsApp user" } : undefined,
            });
          } else {
            await logMessage({ id: msgId(), request, kind: "REMINDER", channel, to: contact, body: renderTemplate(rule.emailBody, v).text, subject: renderTemplate(rule.emailSubject, v).text, status: EMAIL_STATUSES[spreadIndex], sentAt, jobId });
          }
        }
      }
      // Escalation when the threshold is reached (only while the request was still pending).
      if (status === "SENT" && rule.escalateAfter && sentMoments >= rule.escalateAfter && !escalated && req.status === "PENDING") {
        escalated = true;
        await prisma.escalation.create({ data: { id: `seed-esc-${req.id.slice(-2)}`, requestId: req.id, notifiedUserId: company.staff.id, remindersSent: sentMoments, createdAt: minutesAfter(moment.when, 1) } });
        escalationCount += 1;
        await logMessage({
          id: msgId(),
          request,
          kind: "ESCALATION",
          channel: "EMAIL",
          to: company.staff,
          subject: `Escalation: ${company.name} has not uploaded ${docType.name}`,
          body: `${sentMoments} reminders have gone out for ${docType.name} (${company.name}) and nothing has been uploaded yet. A call may be needed.`,
          status: "READ",
          sentAt: minutesAfter(moment.when, 1),
        });
      }
    }

    // The two jobs that are due right now for the "Run reminders now" demo.
    if (req.dueNow) {
      const pastDue = dateOnlyToDb(day(req.due)).getTime() < NOW.getTime();
      for (const channel of channelsFor(rule.channel)) {
        const jobId = `seed-job-${req.id.slice(-2)}-${String(++jobSeq).padStart(2, "0")}`;
        await prisma.reminderJob.create({ data: { id: jobId, requestId: req.id, channel, kind: pastDue ? "REPEAT" : "BEFORE_DUE", scheduledFor: minutesAfter(NOW, -1), status: "SCHEDULED", createdAt } });
        jobCount += 1;
      }
    }
    if (req.status === "PENDING" && rule.repeatEveryDays && moments.some((m) => m.kind === "REPEAT")) {
      // Next link in the chain, strictly in the future.
      const lastRepeat = moments.filter((m) => m.kind === "REPEAT").at(-1)!.when;
      let next = nextRepeatAt(lastRepeat, rule.repeatEveryDays);
      while (next.getTime() <= NOW.getTime()) next = nextRepeatAt(next, rule.repeatEveryDays);
      for (const channel of channelsFor(rule.channel)) {
        const jobId = `seed-job-${req.id.slice(-2)}-${String(++jobSeq).padStart(2, "0")}`;
        await prisma.reminderJob.create({ data: { id: jobId, requestId: req.id, channel, kind: "REPEAT", scheduledFor: next, status: "SCHEDULED", createdAt } });
        jobCount += 1;
      }
    }

    // Documents (files written to ./uploads) and the matching messages.
    if (req.files?.length) {
      let version = 0;
      for (const file of req.files) {
        version += 1;
        const uploader = file.by === "STAFF" ? company.staff : company.contacts[0];
        const uploadedAt = at(file.uploadedAt, file.by === "STAFF" ? "16:10" : "15:00");
        const reviewedAt = file.reviewedAt != null ? at(file.reviewedAt, "11:00") : null;
        const ext = file.kind;
        const key = `companies/${company.id}/requests/${req.id}/seed-v${version}.${ext}`;
        const bytes =
          file.kind === "pdf"
            ? await samplePdf({
                title: docType.name,
                company: company.name,
                lines: [
                  `File: ${file.name}`,
                  `Version ${version}, uploaded ${mytDateString(uploadedAt)} by ${uploader.name}.`,
                  "",
                  "Lorem-free placeholder content: this page stands in for the client's real document",
                  "so the review screen, previews and downloads can be demonstrated end to end.",
                ],
              })
            : await sampleJpg({ title: docType.name, company: company.name });
        const full = path.join(UPLOAD_DIR, key);
        await mkdir(path.dirname(full), { recursive: true });
        await writeFile(full, bytes);
        fileCount += 1;
        await prisma.document.create({
          data: {
            id: `seed-doc-${req.id.slice(-2)}-${version}`,
            requestId: req.id,
            version,
            originalName: file.name,
            storageKey: key,
            sizeBytes: bytes.length,
            mimeType: file.kind === "pdf" ? "application/pdf" : "image/jpeg",
            uploadedById: uploader.id,
            uploadedByRole: file.by,
            uploadedAt,
            reviewStatus: file.review,
            reviewComment: file.comment ?? null,
            reviewedById: reviewedAt ? company.staff.id : null,
            reviewedAt,
          },
        });
        // Upload received (to staff), then the review outcome (to the client).
        await logMessage({ id: msgId(), request, kind: "UPLOAD_RECEIVED", channel: "EMAIL", to: company.staff, subject: `Upload received: ${docType.name} from ${company.name}`, body: `${uploader.name} uploaded ${file.name} for ${company.name}. Reminders for this request have been stopped and it is waiting for your review.`, status: "READ", sentAt: minutesAfter(uploadedAt, 1) });
        if (reviewedAt && file.review !== "AWAITING") {
          const contact = company.contacts[0];
          const approved = file.review === "APPROVED";
          const text = approved
            ? `Good news: ${company.staff.name} has approved the ${docType.name} for ${company.name}. Nothing more is needed for this item.`
            : `${company.staff.name} reviewed the ${docType.name} you uploaded for ${company.name} and needs a correction: "${file.comment}". Please upload a corrected file.`;
          await logMessage({ id: msgId(), request, kind: approved ? "APPROVED" : "CHANGES_REQUESTED", channel: "EMAIL", to: contact, subject: approved ? `Approved: ${docType.name} for ${company.name}` : `Changes needed: ${docType.name} for ${company.name}`, body: text, status: "READ", sentAt: minutesAfter(reviewedAt, 1) });
          if (rule.channel !== "EMAIL") {
            const link = `${APP_URL}/login?next=${encodeURIComponent(`/client/requests/${req.id}`)}`;
            await logMessage({ id: msgId(), request, kind: approved ? "APPROVED" : "CHANGES_REQUESTED", channel: "WHATSAPP", to: contact, body: composeTemplateMessage({ clientName: contact.name, body: text, link }).text, status: "READ", sentAt: minutesAfter(reviewedAt, 1.2) });
          }
        }
      }
    }
  }

  // --- Audit log ------------------------------------------------------------------------------
  const hafiz = companies.get("hafiz")!;
  const audits: { id: string; actorId: string | null; action: string; entity: string; entityId: string; meta: Prisma.InputJsonValue; createdAt: Date }[] = [
    { id: "seed-audit-01", actorId: internal.admin.id, action: "settings.changed", entity: "Setting", entityId: "*", meta: { sendWindowStart: "09:00", sendWindowEnd: "18:00", skipWeekends: true }, createdAt: at(-30, "09:30") },
    { id: "seed-audit-02", actorId: internal.admin.id, action: "reminder_type.changed", entity: "ReminderType", entityId: rules.get("Annual Return (SSM)")!.id, meta: { name: "Annual Return (SSM)" }, createdAt: at(-30, "09:42") },
    { id: "seed-audit-03", actorId: internal.admin.id, action: "company.created", entity: "Company", entityId: hafiz.id, meta: { name: hafiz.name }, createdAt: at(-29, "10:05") },
    { id: "seed-audit-04", actorId: internal.admin.id, action: "user.invite_sent", entity: "User", entityId: hafiz.contacts[0].id, meta: { email: hafiz.contacts[0].email }, createdAt: at(-29, "10:06") },
    { id: "seed-audit-05", actorId: hafiz.contacts[0].id, action: "auth.password_set", entity: "User", entityId: hafiz.contacts[0].id, meta: {}, createdAt: at(-29, "19:40") },
    { id: "seed-audit-06", actorId: internal.aisyah.id, action: "request.created", entity: "DocumentRequest", entityId: "seed-req-07", meta: { companyId: hafiz.id, dueDate: day(-5), jobs: 6 }, createdAt: at(-15, "10:00") },
    { id: "seed-audit-07", actorId: hafiz.contacts[0].id, action: "document.uploaded", entity: "DocumentRequest", entityId: "seed-req-17", meta: { files: [{ name: "tnb-bill-march.pdf", version: 1 }], by: "CLIENT", remindersCancelled: 2 }, createdAt: at(-3, "15:00") },
    { id: "seed-audit-08", actorId: internal.aisyah.id, action: "review.changes_requested", entity: "DocumentRequest", entityId: "seed-req-17", meta: { comment: "This bill is dated March 2026." }, createdAt: at(-2, "11:00") },
    { id: "seed-audit-09", actorId: internal.daniel.id, action: "document.uploaded", entity: "DocumentRequest", entityId: "seed-req-14", meta: { files: [{ name: "management-accounts-q3-2026.pdf", version: 1 }], by: "STAFF", remindersCancelled: 3 }, createdAt: at(-1, "16:10") },
    { id: "seed-audit-10", actorId: internal.aisyah.id, action: "review.approved", entity: "DocumentRequest", entityId: "seed-req-20", meta: { comment: null }, createdAt: at(-7, "11:00") },
    { id: "seed-audit-11", actorId: internal.admin.id, action: "scheduler.manual_tick", entity: "Scheduler", entityId: "tick", meta: { sent: 2, skipped: 0, failed: 0, deferred: 0, via: "ui" }, createdAt: at(-1, "09:03") },
    { id: "seed-audit-12", actorId: internal.aisyah.id, action: "auth.login", entity: "User", entityId: internal.aisyah.id, meta: {}, createdAt: at(0, "09:10") },
    { id: "seed-audit-13", actorId: internal.admin.id, action: "auth.login", entity: "User", entityId: internal.admin.id, meta: {}, createdAt: at(0, "08:45") },
  ];
  for (const a of audits) {
    await prisma.auditLog.create({ data: a });
  }

  console.log(
    [
      `Seeded ${COMPANIES.length} companies, ${COMPANIES.length + 1} clients, ${REQUESTS.length} requests,`,
      `${jobCount} reminder jobs, ${messageCount} messages, ${escalationCount} escalations, ${fileCount} files, ${audits.length} audit rows`,
      `in ${Date.now() - started}ms.`,
      `Demo client: client@vact.demo (notifications → ${DEMO_EMAIL} / ${DEMO_PHONE}).`,
    ].join(" "),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
