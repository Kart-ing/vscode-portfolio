import { describe, expect, it, vi } from "vitest";
import type { WorkRecord } from "@/lib/contract";
import {
  GITHUB_EVENTS_URL,
  GITHUB_REPOS_URL,
  PULSE_RETRY_MS,
  PULSE_TTL_MS,
  createPulseSource,
  mapPulses,
} from "@/lib/server/pulse/github";
import { fixtureRecord } from "./fixture";

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

const NOW = Date.UTC(2026, 8, 16, 12, 0, 0);
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const repos = [
  // Case differs from the record's "example/multiverse".
  { full_name: "example/Multiverse", stargazers_count: 42, pushed_at: daysAgo(2) },
  { full_name: "example/voice-agent", stargazers_count: 7, pushed_at: daysAgo(90) },
  { full_name: "example/unrelated", stargazers_count: 1000, pushed_at: daysAgo(1) },
];
const events = [
  { type: "PushEvent", repo: { name: "example/multiverse" }, created_at: daysAgo(1) },
  { type: "PushEvent", repo: { name: "example/Multiverse" }, created_at: daysAgo(29) },
  { type: "PushEvent", repo: { name: "example/multiverse" }, created_at: daysAgo(31) }, // too old
  { type: "WatchEvent", repo: { name: "example/multiverse" }, created_at: daysAgo(1) }, // not a push
  { type: "PushEvent", repo: { name: "example/voice-agent" }, created_at: daysAgo(5) },
  { type: "PushEvent", repo: { name: "example/unrelated" }, created_at: daysAgo(1) },
  { type: "PushEvent", repo: { name: "example/robotics" }, created_at: daysAgo(1) }, // repo not listed
  { type: "PushEvent", repo: { name: "example/multiverse" } }, // no date
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function githubFetch(overrides: Partial<Record<string, () => Response | Promise<Response>>> = {}): FetchMock {
  return vi.fn(async (input) => {
    const url = String(input);
    const custom = overrides[url];
    if (custom) return custom();
    if (url === GITHUB_REPOS_URL) return json(repos);
    if (url === GITHUB_EVENTS_URL) return json(events);
    return new Response("not found", { status: 404 });
  });
}

describe("mapPulses", () => {
  it("maps stars with a listed repo to stars, last push and pushes in the last 30 days", () => {
    expect(mapPulses(fixtureRecord, repos, events, NOW)).toEqual([
      { starId: "multiverse", repo: "example/multiverse", stars: 42, lastPushAt: daysAgo(2), pushesLast30d: 2 },
      { starId: "hackmit", repo: "example/voice-agent", stars: 7, lastPushAt: daysAgo(90), pushesLast30d: 1 },
    ]);
  });

  it("skips stars without a repo and repos GitHub did not list", () => {
    const ids = mapPulses(fixtureRecord, repos, events, NOW).map((p) => p.starId);
    expect(ids).not.toContain("robotics-club");
    expect(ids).not.toContain("karts");
  });

  it("tolerates garbage payloads", () => {
    expect(mapPulses(fixtureRecord, { message: "rate limited" }, null, NOW)).toEqual([]);
    expect(mapPulses(fixtureRecord, [null, 1, { full_name: 3 }], [null, { type: "PushEvent" }], NOW)).toEqual([]);
    expect(mapPulses(fixtureRecord, [{ full_name: "example/multiverse" }], "nope", NOW)).toEqual([
      { starId: "multiverse", repo: "example/multiverse", stars: 0, lastPushAt: null, pushesLast30d: 0 },
    ]);
  });
});

describe("createPulseSource", () => {
  it("calls both GitHub endpoints with the site's user agent and an optional token", async () => {
    const fetchImpl = githubFetch();
    const source = createPulseSource({ record: fixtureRecord, fetchImpl, now: () => NOW, getToken: () => "gh-token", log: () => {} });
    const pulses = await source.getPulses();
    expect(pulses.map((p) => p.starId)).toEqual(["multiverse", "hackmit"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const urls = fetchImpl.mock.calls.map(([url]) => String(url)).sort();
    expect(urls).toEqual([GITHUB_EVENTS_URL, GITHUB_REPOS_URL].sort());
    for (const [, init] of fetchImpl.mock.calls) {
      const headers = new Headers(init?.headers);
      expect(headers.get("user-agent")).toBe("kartikey.fyi");
      expect(headers.get("authorization")).toBe("Bearer gh-token");
      expect(headers.get("accept")).toContain("application/vnd.github");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("sends no authorization header without a token", async () => {
    const fetchImpl = githubFetch();
    await createPulseSource({ record: fixtureRecord, fetchImpl, now: () => NOW, getToken: () => undefined, log: () => {} }).getPulses();
    for (const [, init] of fetchImpl.mock.calls) expect(new Headers(init?.headers).get("authorization")).toBeNull();
  });

  it("caches for 15 minutes and refreshes after", async () => {
    let now = NOW;
    const fetchImpl = githubFetch();
    const source = createPulseSource({ record: fixtureRecord, fetchImpl, now: () => now, getToken: () => undefined, log: () => {} });
    const first = await source.getPulses();
    now += PULSE_TTL_MS - 1;
    expect(await source.getPulses()).toBe(first);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    now += 2;
    await source.getPulses();
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("shares one refresh between concurrent callers", async () => {
    const fetchImpl = githubFetch();
    const source = createPulseSource({ record: fixtureRecord, fetchImpl, now: () => NOW, getToken: () => undefined, log: () => {} });
    const [a, b] = await Promise.all([source.getPulses(), source.getPulses()]);
    expect(a).toEqual(b);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns [] on any failure and retries after a short pause", async () => {
    let now = NOW;
    for (const fetchImpl of [
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
      githubFetch({ [GITHUB_REPOS_URL]: () => json({ message: "API rate limit exceeded" }, 403) }),
      githubFetch({ [GITHUB_EVENTS_URL]: () => new Response("<html>", { status: 200 }) }),
    ] as FetchMock[]) {
      now = NOW;
      const source = createPulseSource({ record: fixtureRecord, fetchImpl, now: () => now, getToken: () => undefined, log: () => {} });
      expect(await source.getPulses()).toEqual([]);
      const calls = fetchImpl.mock.calls.length;
      expect(await source.getPulses()).toEqual([]);
      expect(fetchImpl.mock.calls.length).toBe(calls);
      now += PULSE_RETRY_MS + 1;
      await source.getPulses();
      expect(fetchImpl.mock.calls.length).toBeGreaterThan(calls);
    }
  });

  it("does not call GitHub when no star has a repo", async () => {
    const fetchImpl = githubFetch();
    const record: WorkRecord = {
      ...fixtureRecord,
      stars: fixtureRecord.stars.map((star) => ({ ...star, repo: undefined })),
    };
    expect(await createPulseSource({ record, fetchImpl, now: () => NOW, log: () => {} }).getPulses()).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
