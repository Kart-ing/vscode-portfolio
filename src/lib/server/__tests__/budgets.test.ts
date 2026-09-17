import { describe, expect, it } from "vitest";
import {
  DailyBudget,
  RollingWindowLimiter,
  clientKeyFromHeaders,
  hashClientId,
} from "@/lib/server/flight/budgets";
import { LruCache } from "@/lib/server/flight/lru";

const MINUTE = 60_000;

describe("RollingWindowLimiter", () => {
  it("allows the limit within the window and refuses the next", () => {
    const limiter = new RollingWindowLimiter(6, 10 * MINUTE);
    const t0 = Date.UTC(2026, 8, 16, 12, 0, 0);
    for (let i = 0; i < 6; i += 1) expect(limiter.tryConsume("a", t0 + i * 1000)).toBe(true);
    expect(limiter.tryConsume("a", t0 + 7000)).toBe(false);
    // Another client has its own budget.
    expect(limiter.tryConsume("b", t0 + 7000)).toBe(true);
  });

  it("frees budget as calls age out", () => {
    const limiter = new RollingWindowLimiter(2, 10 * MINUTE);
    const t0 = Date.UTC(2026, 8, 16, 12, 0, 0);
    expect(limiter.tryConsume("a", t0)).toBe(true);
    expect(limiter.tryConsume("a", t0 + 5 * MINUTE)).toBe(true);
    expect(limiter.tryConsume("a", t0 + 6 * MINUTE)).toBe(false);
    // The first call left the window; one slot opens.
    expect(limiter.tryConsume("a", t0 + 10 * MINUTE + 1)).toBe(true);
    expect(limiter.tryConsume("a", t0 + 10 * MINUTE + 2)).toBe(false);
  });

  it("sweeps idle clients", () => {
    const limiter = new RollingWindowLimiter(1, MINUTE);
    const t0 = Date.UTC(2026, 8, 16, 12, 0, 0);
    for (let i = 0; i < 600; i += 1) limiter.tryConsume(`client-${i}`, t0);
    expect(limiter.trackedClients).toBeGreaterThan(0);
    for (let i = 0; i < 500; i += 1) limiter.tryConsume("later", t0 + 2 * MINUTE + i);
    expect(limiter.trackedClients).toBeLessThan(600);
  });
});

describe("DailyBudget", () => {
  it("caps calls per UTC day and resets at midnight", () => {
    const budget = new DailyBudget(45);
    const day = Date.UTC(2026, 8, 16, 23, 0, 0);
    for (let i = 0; i < 45; i += 1) expect(budget.tryConsume(day + i)).toBe(true);
    expect(budget.tryConsume(day + 100)).toBe(false);
    expect(budget.remaining(day + 100)).toBe(0);
    const nextDay = Date.UTC(2026, 8, 17, 0, 0, 1);
    expect(budget.remaining(nextDay)).toBe(45);
    expect(budget.tryConsume(nextDay)).toBe(true);
  });
});

describe("client keys", () => {
  it("hashes the first forwarded address and never exposes it", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    const key = clientKeyFromHeaders(headers);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain("203.0.113.5");
    expect(key).toBe(hashClientId("203.0.113.5"));
    expect(key).not.toBe(hashClientId("10.0.0.1"));
  });

  it("falls back to x-real-ip and then to unknown", () => {
    expect(clientKeyFromHeaders(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe(
      hashClientId("198.51.100.7"),
    );
    expect(clientKeyFromHeaders(new Headers())).toBe(hashClientId("unknown"));
    expect(clientKeyFromHeaders(new Headers({ "x-forwarded-for": " " }))).toBe(hashClientId("unknown"));
  });
});

describe("LruCache", () => {
  it("stores, returns and expires values", () => {
    let now = 1_000;
    const cache = new LruCache<string, number>(10, 100, () => now);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    now = 1_099;
    expect(cache.get("a")).toBe(1);
    now = 1_100;
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("evicts the least recently used entry at capacity", () => {
    const cache = new LruCache<string, number>(2, 60_000, () => 0);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1); // a is now most recent
    cache.set("c", 3); // evicts b
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
    expect(cache.size).toBe(2);
  });

  it("holds at most 200 entries with the production settings", () => {
    const cache = new LruCache<string, number>(200, 60_000, () => 0);
    for (let i = 0; i < 500; i += 1) cache.set(`q${i}`, i);
    expect(cache.size).toBe(200);
    expect(cache.get("q0")).toBeUndefined();
    expect(cache.get("q499")).toBe(499);
  });
});
