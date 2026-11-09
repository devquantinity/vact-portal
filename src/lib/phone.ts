import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normalises a phone number to E.164. Malaysian numbers are the default:
 * "012-345 6789" -> "+60123456789". Returns null when the input is not a valid number.
 */
export function normalisePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, "MY");
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164
}

/** "+60123456789" -> "012-345 6789" for display. Falls back to the raw value. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === "MY" ? parsed.formatNational() : parsed.formatInternational();
}
