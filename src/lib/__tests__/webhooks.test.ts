import { describe, expect, it } from "vitest";
import { metaSignatureFor, validMetaSignature } from "@/lib/webhooks/signature";

describe("Meta webhook signature", () => {
  const body = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.1", status: "read", timestamp: "1" }] } }] }] });
  it("accepts a correct signature and rejects a tampered body", () => {
    const sig = metaSignatureFor(body, "app-secret");
    expect(validMetaSignature(body, sig, "app-secret")).toBe(true);
    expect(validMetaSignature(body.replace("read", "failed"), sig, "app-secret")).toBe(false);
    expect(validMetaSignature(body, "sha256=zz", "app-secret")).toBe(false);
    expect(validMetaSignature(body, null, "app-secret")).toBe(false);
  });
  it("skips verification only when no app secret is configured", () => {
    expect(validMetaSignature(body, null, "")).toBe(true);
  });
});
