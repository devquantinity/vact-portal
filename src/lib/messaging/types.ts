export type DeliveryResult =
  | { ok: true; providerMessageId: string; simulated: boolean }
  | { ok: false; errorCode: string; errorMessage: string };

export function simulatedId(prefix: "sim" | "sim-email" = "sim"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
