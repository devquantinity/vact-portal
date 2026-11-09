/**
 * Placeholder rendering for reminder templates. Admins write free text with {placeholders};
 * unknown placeholders are left as-is so the editor can flag them.
 */

export const PLACEHOLDERS = [
  { key: "client_name", label: "Client name", description: "Name of the contact receiving the message", sample: "Encik Hafiz Rahman" },
  { key: "company", label: "Company", description: "Company name", sample: "Hafiz Trading Sdn Bhd" },
  { key: "document", label: "Document", description: "Document type requested", sample: "Audited financial statements" },
  { key: "due_date", label: "Due date", description: "e.g. 25 Nov 2026", sample: "25 Nov 2026" },
  { key: "days_left", label: "Days left", description: '"3 days left", "Due today" or "3 days overdue"', sample: "3 days left" },
  { key: "link", label: "Link", description: "Login link that opens the request", sample: "https://portal.example/login?next=/client/requests/abc123" },
  { key: "staff_name", label: "Staff name", description: "Assigned V ACT officer", sample: "Aisyah Rahman" },
  { key: "staff_phone", label: "Staff phone", description: "Officer's phone number", sample: "+6013-279 5163" },
  { key: "firm", label: "Firm", description: "V ACT Management Services Sdn Bhd", sample: "V ACT Management Services Sdn Bhd" },
] as const;

export type PlaceholderKey = (typeof PLACEHOLDERS)[number]["key"];
export type TemplateVars = Record<PlaceholderKey, string>;

const KNOWN = new Set<string>(PLACEHOLDERS.map((p) => p.key));
const PATTERN = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

export function sampleVars(overrides: Partial<TemplateVars> = {}): TemplateVars {
  const vars = Object.fromEntries(PLACEHOLDERS.map((p) => [p.key, p.sample])) as TemplateVars;
  return { ...vars, ...overrides };
}

/** Placeholders used in the template that are not in the supported list. */
export function findUnknownPlaceholders(template: string): string[] {
  const unknown = new Set<string>();
  for (const match of template.matchAll(PATTERN)) {
    if (!KNOWN.has(match[1])) unknown.add(match[1]);
  }
  return [...unknown];
}

/** Placeholders used in the template that are supported. */
export function findUsedPlaceholders(template: string): PlaceholderKey[] {
  const used = new Set<PlaceholderKey>();
  for (const match of template.matchAll(PATTERN)) {
    if (KNOWN.has(match[1])) used.add(match[1] as PlaceholderKey);
  }
  return [...used];
}

export function renderTemplate(template: string, vars: Partial<TemplateVars>): { text: string; unknown: string[] } {
  const unknown: string[] = [];
  const text = template.replace(PATTERN, (whole, key: string) => {
    if (KNOWN.has(key)) {
      const value = vars[key as PlaceholderKey];
      return value == null ? "" : value;
    }
    if (!unknown.includes(key)) unknown.push(key);
    return whole; // unknown placeholders render as-is
  });
  return { text, unknown };
}
