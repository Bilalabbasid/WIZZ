/**
 * Lightweight, in-memory sliding window rate limiter for security-sensitive endpoints.
 * Thread-safe for Node.js event-loop operations.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

// Cleanup stale records every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 600000); // 10 minutes
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 300000).unref?.();
}

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number;      // Maximum allowed requests in window
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = { windowMs: 60000, max: 10 }
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  // Filter out timestamps outside the sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= options.max) {
    const oldestTimestamp = record.timestamps[0];
    const resetMs = Math.max(0, oldestTimestamp + options.windowMs - now);
    return {
      success: false,
      limit: options.max,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);

  return {
    success: true,
    limit: options.max,
    remaining: options.max - record.timestamps.length,
    resetMs: options.windowMs,
  };
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}
