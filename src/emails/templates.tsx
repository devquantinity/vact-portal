import * as React from "react";
import { render } from "react-email";
import { EmailLayout, FreeText, InfoBox, Muted, P } from "./layout";

type Common = { appUrl: string; brandName: string };

export type RenderedEmail = { subject: string; html: string; text: string };

async function renderBoth(subject: string, element: React.ReactElement): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject, html, text };
}

/** 1. Invite / set password */
export function inviteEmail(p: Common & { name: string; link: string; isReset?: boolean; expiresHours: number }) {
  const subject = p.isReset ? "Reset your V ACT Client Portal password" : "Your V ACT Client Portal account";
  return renderBoth(
    subject,
    <EmailLayout
      preview={subject}
      heading={p.isReset ? "Reset your password" : "Set your password"}
      appUrl={p.appUrl}
      brandName={p.brandName}
      cta={{ label: p.isReset ? "Choose a new password" : "Set my password", href: p.link }}
    >
      <P>Hello {p.name},</P>
      {p.isReset ? (
        <P>We received a request to reset the password for your account. Use the button below to choose a new one.</P>
      ) : (
        <P>
          V ACT has created your account on the {p.brandName}. This is where you will see the documents V ACT needs
          from your company, upload them, and track what has been approved.
        </P>
      )}
      <Muted>This link is valid for {p.expiresHours} hours. If you did not expect this email you can ignore it.</Muted>
    </EmailLayout>,
  );
}

/** 2. Document request created */
export function requestCreatedEmail(
  p: Common & {
    clientName: string;
    company: string;
    document: string;
    dueDate: string;
    instructions?: string | null;
    staffName: string;
    link: string;
    subject: string;
    body: string;
  },
) {
  return renderBoth(
    p.subject,
    <EmailLayout
      preview={`${p.document} for ${p.company} is due ${p.dueDate}`}
      heading="New document request"
      appUrl={p.appUrl}
      brandName={p.brandName}
      cta={{ label: "Open the portal", href: p.link }}
    >
      <FreeText text={p.body} />
      <InfoBox
        rows={[
          { label: "Company", value: p.company },
          { label: "Document", value: p.document },
          { label: "Due date", value: p.dueDate },
          ...(p.instructions ? [{ label: "Instructions", value: p.instructions }] : []),
        ]}
      />
      <Muted>Your V ACT officer: {p.staffName}</Muted>
    </EmailLayout>,
  );
}

/** 3. Reminder (template body written by admin) */
export function reminderEmail(
  p: Common & {
    subject: string;
    body: string;
    company: string;
    document: string;
    dueDate: string;
    daysLeft: string;
    link: string;
    staffName: string;
  },
) {
  return renderBoth(
    p.subject,
    <EmailLayout
      preview={`${p.document} · ${p.daysLeft}`}
      heading={p.subject}
      appUrl={p.appUrl}
      brandName={p.brandName}
      cta={{ label: "Upload now", href: p.link }}
    >
      <FreeText text={p.body} />
      <InfoBox
        rows={[
          { label: "Company", value: p.company },
          { label: "Document", value: p.document },
          { label: "Due date", value: `${p.dueDate} (${p.daysLeft})` },
        ]}
      />
      <Muted>Your V ACT officer: {p.staffName}</Muted>
    </EmailLayout>,
  );
}

/** 4. Changes requested */
export function changesRequestedEmail(
  p: Common & { clientName: string; company: string; document: string; comment: string; staffName: string; link: string },
) {
  const subject = `Changes needed: ${p.document} for ${p.company}`;
  return renderBoth(
    subject,
    <EmailLayout
      preview={subject}
      heading="Changes requested"
      appUrl={p.appUrl}
      brandName={p.brandName}
      cta={{ label: "Upload a corrected file", href: p.link }}
    >
      <P>Hello {p.clientName},</P>
      <P>
        {p.staffName} reviewed the {p.document} you uploaded for {p.company} and needs a correction before it can be
        accepted:
      </P>
      <InfoBox rows={[{ label: "Comment from V ACT", value: p.comment }]} />
      <P>Please upload a corrected version through the portal so we can complete the filing.</P>
    </EmailLayout>,
  );
}

/** 5. Document approved */
export function approvedEmail(p: Common & { clientName: string; company: string; document: string; staffName: string; link: string }) {
  const subject = `Approved: ${p.document} for ${p.company}`;
  return renderBoth(
    subject,
    <EmailLayout
      preview={subject}
      heading="Document approved"
      appUrl={p.appUrl}
      brandName={p.brandName}
      cta={{ label: "View your documents", href: p.link }}
    >
      <P>Hello {p.clientName},</P>
      <P>
        {p.staffName} has approved the {p.document} for {p.company}. No further action is needed for this item.
      </P>
    </EmailLayout>,
  );
}

/** 6. Escalation to staff */
export function escalationEmail(
  p: Common & {
    staffName: string;
    company: string;
    document: string;
    dueDate: string;
    daysLeft: string;
    remindersSent: number;
    contacts: string;
    link: string;
  },
) {
  const subject = `Escalation: ${p.company} has not uploaded ${p.document}`;
  return renderBoth(
    subject,
    <EmailLayout
      preview={subject}
      heading="Client has not responded"
      appUrl={p.appUrl}
      brandName={p.brandName}
      cta={{ label: "Open the request", href: p.link }}
    >
      <P>Hello {p.staffName},</P>
      <P>
        {p.remindersSent} reminders have gone out for this request and nothing has been uploaded yet. A call may be
        needed.
      </P>
      <InfoBox
        rows={[
          { label: "Company", value: p.company },
          { label: "Document", value: p.document },
          { label: "Due date", value: `${p.dueDate} (${p.daysLeft})` },
          { label: "Contacts", value: p.contacts },
        ]}
      />
    </EmailLayout>,
  );
}

/** 7. Upload received (to staff) */
export function uploadReceivedEmail(
  p: Common & { staffName: string; company: string; document: string; uploadedBy: string; fileNames: string; link: string },
) {
  const subject = `Upload received: ${p.document} from ${p.company}`;
  return renderBoth(
    subject,
    <EmailLayout
      preview={subject}
      heading="New upload to review"
      appUrl={p.appUrl}
      brandName={p.brandName}
      cta={{ label: "Review now", href: p.link }}
    >
      <P>Hello {p.staffName},</P>
      <P>
        {p.uploadedBy} uploaded {p.fileNames} for {p.company}. Reminders for this request have been stopped and it is
        waiting for your review.
      </P>
      <InfoBox
        rows={[
          { label: "Company", value: p.company },
          { label: "Document", value: p.document },
        ]}
      />
    </EmailLayout>,
  );
}

/** Test message from the reminder-type editor */
export function testEmail(p: Common & { subject: string; body: string; link: string }) {
  return renderBoth(
    `[Test] ${p.subject}`,
    <EmailLayout
      preview="Test message from the reminder type editor"
      heading={p.subject}
      appUrl={p.appUrl}
      brandName={p.brandName}
      cta={{ label: "Open the portal", href: p.link }}
    >
      <FreeText text={p.body} />
      <Muted>This is a test sent from the reminder type editor with sample data.</Muted>
    </EmailLayout>,
  );
}
