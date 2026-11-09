import { describe, expect, it } from "vitest";
import { formatPhone, normalisePhone } from "@/lib/phone";

describe("normalisePhone", () => {
  it("normalises Malaysian mobile numbers to E.164", () => {
    expect(normalisePhone("012-345 6789")).toBe("+60123456789");
    expect(normalisePhone("0123456789")).toBe("+60123456789");
    expect(normalisePhone("60123456789")).toBe("+60123456789");
    expect(normalisePhone("+60 12-345 6789")).toBe("+60123456789");
  });
  it("keeps foreign numbers in international format", () => {
    expect(normalisePhone("+65 9123 4567")).toBe("+6591234567");
  });
  it("rejects rubbish", () => {
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone("abc")).toBeNull();
    expect(normalisePhone("123")).toBeNull();
  });
  it("formats for display", () => {
    expect(formatPhone("+60123456789")).toBe("012-345 6789");
  });
});
