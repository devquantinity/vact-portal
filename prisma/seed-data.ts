/** Static seed content shared by the seed script. Keep names stable: the seed upserts by them. */

export const DOCUMENT_TYPES: {
  name: string;
  description: string;
  acceptedExtensions: string[];
  maxSizeMb?: number;
  allowMultipleFiles?: boolean;
}[] = [
  {
    name: "NRIC / passport copy of directors",
    description: "Front and back of the NRIC, or the passport photo page, for every director and shareholder.",
    acceptedExtensions: ["pdf", "jpg", "jpeg", "png"],
    allowMultipleFiles: true,
  },
  {
    name: "Proof of address",
    description: "A utility bill or bank statement dated within the last 3 months showing the residential address.",
    acceptedExtensions: ["pdf", "jpg", "jpeg", "png"],
    allowMultipleFiles: true,
  },
  {
    name: "Audited financial statements",
    description: "Signed audited accounts for the financial year, including the directors' report and auditor's report.",
    acceptedExtensions: ["pdf"],
    maxSizeMb: 25,
  },
  {
    name: "Management accounts",
    description: "Profit and loss statement and balance sheet for the period, exported from your accounting system.",
    acceptedExtensions: ["pdf", "xlsx", "xls"],
    allowMultipleFiles: true,
  },
  {
    name: "Bank statements",
    description: "Company bank statements for the months requested. One file per month is fine.",
    acceptedExtensions: ["pdf"],
    allowMultipleFiles: true,
  },
  {
    name: "Director's resolution (signed)",
    description: "The circular resolution we prepared, signed by all directors. Scan all pages into one PDF.",
    acceptedExtensions: ["pdf"],
  },
  {
    name: "Annual return information (Section 68)",
    description: "Confirmation of registered office, business address, directors, shareholders and principal activities.",
    acceptedExtensions: ["pdf", "docx", "xlsx"],
  },
  {
    name: "Tax computation / CP204 working",
    description: "Estimated tax payable working for the CP204 submission, or the tax computation from your tax agent.",
    acceptedExtensions: ["pdf", "xlsx"],
  },
  {
    name: "Payroll summary (Form E)",
    description: "Payroll summary for the year supporting the Form E and EA submission.",
    acceptedExtensions: ["pdf", "xlsx"],
  },
  {
    name: "Share transfer instrument (Section 105)",
    description: "Signed Form of Transfer of Securities with the stamping certificate from LHDN.",
    acceptedExtensions: ["pdf"],
    allowMultipleFiles: true,
  },
];

export type ReminderTypeSeed = {
  name: string;
  description: string;
  channel: "WHATSAPP" | "EMAIL" | "BOTH";
  daysBefore: number[];
  repeatEveryDays: number | null;
  escalateAfter: number | null;
  whatsappBody: string;
  emailSubject: string;
  emailBody: string;
};

export const REMINDER_TYPES: ReminderTypeSeed[] = [
  {
    name: "Document request (standard)",
    description: "Default rule for most documents: three reminders before the due date, then every 3 days until uploaded.",
    channel: "BOTH",
    daysBefore: [14, 7, 1],
    repeatEveryDays: 3,
    escalateAfter: 3,
    whatsappBody:
      "{document} for {company} is due on {due_date} ({days_left}). Please upload it through the portal so we can keep your filings on track.",
    emailSubject: "Reminder: {document} for {company} due {due_date}",
    emailBody:
      "Dear {client_name},\n\nThis is a reminder that we are still waiting for the following document for {company}:\n\n{document} — due {due_date} ({days_left}).\n\nPlease upload it through the V ACT Client Portal using the button below. Reminders stop automatically once the document is received.\n\nIf you have any questions, contact {staff_name} at {staff_phone}.\n\nThank you,\n{firm}",
  },
  {
    name: "Annual Return (SSM)",
    description: "For Section 68 annual return information. Longer run-up and tighter repeats because late lodgement attracts an SSM penalty.",
    channel: "BOTH",
    daysBefore: [30, 14, 7, 1],
    repeatEveryDays: 2,
    escalateAfter: 4,
    whatsappBody:
      "The {document} for {company} is due on {due_date} ({days_left}). Late lodgement of the annual return attracts an SSM penalty, so please upload the information as soon as possible.",
    emailSubject: "Annual return for {company}: information needed by {due_date}",
    emailBody:
      "Dear {client_name},\n\nThe annual return for {company} must be lodged with SSM within 30 days of the anniversary of incorporation. We need the following from you by {due_date} ({days_left}):\n\n{document}\n\nLate lodgement attracts a penalty from SSM under the Companies Act 2016, and repeated failures can lead to the company being struck off. Please upload the information through the portal using the button below.\n\nYour officer {staff_name} ({staff_phone}) is happy to help if anything is unclear.\n\nRegards,\n{firm}",
  },
  {
    name: "Audited accounts",
    description: "Email-only schedule for audited financial statements with a long lead time and weekly repeats.",
    channel: "EMAIL",
    daysBefore: [60, 30, 14],
    repeatEveryDays: 7,
    escalateAfter: null,
    whatsappBody:
      "Your {document} for {company} are due on {due_date} ({days_left}). Please upload the signed set through the portal.",
    emailSubject: "{document} for {company}: due {due_date}",
    emailBody:
      "Dear {client_name},\n\nThe {document} for {company} are due on {due_date} ({days_left}). Once the accounts are signed, please upload the complete set (directors' report, auditor's report and financial statements) through the portal.\n\nWe will circulate them for lodgement with SSM as soon as they are received.\n\nRegards,\n{staff_name}\n{firm}",
  },
  {
    name: "Peringatan dokumen (BM)",
    description: "Peringatan WhatsApp dalam Bahasa Melayu untuk klien yang lebih selesa berbahasa Melayu.",
    channel: "WHATSAPP",
    daysBefore: [7, 3, 1],
    repeatEveryDays: 2,
    escalateAfter: 3,
    whatsappBody:
      "Assalamualaikum / Salam sejahtera {client_name}. Kami masih menunggu {document} untuk {company} yang perlu diserahkan pada {due_date} ({days_left}). Sila muat naik dokumen tersebut melalui portal. Terima kasih.",
    emailSubject: "Peringatan: {document} untuk {company} perlu diserahkan pada {due_date}",
    emailBody:
      "Salam sejahtera {client_name},\n\nKami masih menunggu {document} untuk {company}. Tarikh akhir penyerahan ialah {due_date} ({days_left}).\n\nSila muat naik dokumen melalui Portal Klien V ACT dengan menekan butang di bawah. Peringatan akan berhenti secara automatik selepas dokumen diterima.\n\nSebarang pertanyaan, hubungi {staff_name} di {staff_phone}.\n\nTerima kasih,\n{firm}",
  },
];
