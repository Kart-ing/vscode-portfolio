// Model-call budgets, in memory per server instance. Clients are keyed by a
// salted SHA-256 of their IP so no raw address is ever stored or logged.

import { createHash } from "node:crypto";

const CLIENT_SALT = "kartikey.fyi/flight/v2";

/** Per-client rolling window: at most `limit` calls in the last `windowMs`. */
export class RollingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  private calls = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Records a call for `key` and returns true, or returns false when over budget. */
  tryConsume(key: string, now: number = Date.now()): boolean {
    this.maybeSweep(now);
    const floor = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > floor);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  get trackedClients(): number {
    return this.hits.size;
  }

  /** Drops clients whose every hit has aged out, so the map cannot grow forever. */
  private maybeSweep(now: number): void {
    this.calls += 1;
    if (this.calls % 500 !== 0 && this.hits.size < 5000) return;
    const floor = now - this.windowMs;
    for (const [key, times] of this.hits) {
      if (!times.some((t) => t > floor)) this.hits.delete(key);
    }
  }
}

/** Instance-wide budget that resets at 00:00 UTC. */
export class DailyBudget {
  private day = "";
  private used = 0;

  constructor(private readonly limit: number) {}

  tryConsume(now: number = Date.now()): boolean {
    this.roll(now);
    if (this.used >= this.limit) return false;
    this.used += 1;
    return true;
  }

  remaining(now: number = Date.now()): number {
    this.roll(now);
    return Math.max(0, this.limit - this.used);
  }

  private roll(now: number): void {
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.used = 0;
    }
  }
}

/** First x-forwarded-for address, else x-real-ip, else "unknown"; then salted SHA-256. */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const ip = first || headers.get("x-real-ip")?.trim() || "unknown";
  return hashClientId(ip);
}

export function hashClientId(ip: string): string {
  return createHash("sha256").update(`${CLIENT_SALT}\n${ip}`).digest("hex");
}
