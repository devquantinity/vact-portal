import { describe, expect, it } from "vitest";
import { findUnknownPlaceholders, renderTemplate, sampleVars } from "@/lib/templates/render";
import { collapseWhitespace, composeTemplateMessage, truncate } from "@/lib/messaging/whatsapp";

describe("renderTemplate", () => {
  it("fills known placeholders", () => {
    const { text, unknown } = renderTemplate("Hi {client_name}, {document} for {company} is due {due_date} ({days_left}).", {
      client_name: "Hafiz",
      document: "Bank statements",
      company: "Hafiz Trading Sdn Bhd",
      due_date: "25 Nov 2026",
      days_left: "3 days overdue",
    });
    expect(text).toBe("Hi Hafiz, Bank statements for Hafiz Trading Sdn Bhd is due 25 Nov 2026 (3 days overdue).");
    expect(unknown).toEqual([]);
  });

  it("leaves unknown placeholders as-is and reports them", () => {
    const { text, unknown } = renderTemplate("Hello {client_name}, ref {invoice_no} and {Nope}", sampleVars({ client_name: "Ali" }));
    expect(text).toBe("Hello Ali, ref {invoice_no} and {Nope}");
    expect(unknown).toEqual(["invoice_no", "Nope"]);
    expect(findUnknownPlaceholders("{client_name} {invoice_no} {invoice_no}")).toEqual(["invoice_no"]);
  });

  it("renders every documented placeholder with sample data", () => {
    const template = "{client_name}|{company}|{document}|{due_date}|{days_left}|{link}|{staff_name}|{staff_phone}|{firm}";
    const { text, unknown } = renderTemplate(template, sampleVars());
    expect(unknown).toEqual([]);
    expect(text).not.toContain("{");
  });
});

describe("WhatsApp template composition", () => {
  it("collapses newlines, tabs and long runs of spaces", () => {
    expect(collapseWhitespace("line one\n\nline two\t\tend      here")).toBe("line one line two end here");
  });

  it("truncates with an ellipsis", () => {
    expect(truncate("abcdefghij", 8)).toBe("abcde...");
    expect(truncate("short", 8)).toBe("short");
  });

  it("keeps the composed body under Meta's 1,024 character limit", () => {
    const { parameters, text } = composeTemplateMessage({
      clientName: "Hafiz",
      body: "x".repeat(2000),
      link: "http://localhost:3000/login?next=/client/requests/abc",
    });
    expect(text.length).toBeLessThanOrEqual(1024);
    expect(parameters[1].endsWith("...")).toBe(true);
    expect(parameters[1]).not.toMatch(/\n|\t| {5,}/);
  });
});
