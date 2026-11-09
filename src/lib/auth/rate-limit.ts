/**
 * In-memory sliding window rate limiter: 5 attempts per 15 minutes per key.
 * Good enough for a single-process demo; swap for Redis when the app is clustered.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Bucket = { timestamps: number[] };
const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number) {
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
}

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  prune(bucket, now);
  buckets.set(key, bucket);
  if (bucket.timestamps.length >= MAX_ATTEMPTS) {
    const oldest = bucket.timestamps[0];
    return { allowed: false, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - oldest)) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordAttempt(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  prune(bucket, now);
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
}

export function clearAttempts(key: string) {
  buckets.delete(key);
}

export function rateLimitKey(scope: string, ip: string, email: string) {
  return `${scope}:${ip}:${email.trim().toLowerCase()}`;
}
