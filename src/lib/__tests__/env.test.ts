import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";
import { workerStaleMs } from "@/lib/settings";

const BASE = {
  DATABASE_URL: "postgresql://vact:vact@localhost:5432/vact_portal",
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
};

describe("parseEnv", () => {
  it("treats empty values as unset so .env.example works as-is", () => {
    const e = parseEnv({ ...BASE, STORAGE_DRIVER: "", MAX_UPLOAD_MB: "", TICK_INTERVAL_MINUTES: "", BLOB_READ_WRITE_TOKEN: "", APP_URL: "" });
    expect(e.STORAGE_DRIVER).toBeUndefined();
    expect(e.MAX_UPLOAD_MB).toBeUndefined();
    expect(e.TICK_INTERVAL_MINUTES).toBeUndefined();
    expect(e.BLOB_READ_WRITE_TOKEN).toBe("");
    expect(e.APP_URL).toBe("http://localhost:3000");
  });

  it("coerces numeric settings", () => {
    const e = parseEnv({ ...BASE, MAX_UPLOAD_MB: "4", TICK_INTERVAL_MINUTES: "15", STORAGE_DRIVER: "blob" });
    expect(e.MAX_UPLOAD_MB).toBe(4);
    expect(e.TICK_INTERVAL_MINUTES).toBe(15);
    expect(e.STORAGE_DRIVER).toBe("blob");
  });

  it("rejects a short session secret and a bad upload cap", () => {
    expect(() => parseEnv({ ...BASE, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
    expect(() => parseEnv({ ...BASE, MAX_UPLOAD_MB: "0" })).toThrow(/MAX_UPLOAD_MB/);
  });
});

describe("workerStaleMs", () => {
  it("allows two missed intervals plus a minute", () => {
    expect(workerStaleMs(1)).toBe(3 * 60_000); // worker: stale after 3 minutes
    expect(workerStaleMs(15)).toBe(31 * 60_000); // Vercel Hobby schedule: 15 min + 15 min jitter + 1
  });
});
