import type { z } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type ActionState<T = undefined> = ActionResult<T> | null;

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function succeed<T>(message?: string, data?: T): ActionResult<T> {
  return { ok: true, message, data };
}

/** Parses FormData with a Zod schema, returning the first error per field. */
export function parseForm<S extends z.ZodTypeAny>(
  schema: S,
  formData: FormData,
): { success: true; data: z.infer<S> } | { success: false; error: string; fieldErrors: Record<string, string> } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      (raw[k] ??= []) as unknown[];
      (raw[k] as unknown[]).push(value);
    } else {
      raw[key] = value;
    }
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { success: true, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.join(".") || "_";
    if (!fieldErrors[path]) fieldErrors[path] = issue.message;
  }
  const first = parsed.error.issues[0];
  return {
    success: false,
    error: first ? `${first.path.length ? `${String(first.path[0])}: ` : ""}${first.message}` : "Check the form.",
    fieldErrors,
  };
}

/** Empty strings from forms become null. */
export function emptyToNull(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

export function isRedirectError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}
