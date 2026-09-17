// Live proof-of-work from GitHub: two public API calls per refresh, mapped to
// one RepoPulse per star that names a repo, cached in memory for 15 minutes.
// Any failure yields [] (and a short retry pause), never an error.

import type { RepoPulse, WorkRecord } from "@/lib/contract";

export const GITHUB_USER = "Kart-ing";
export const GITHUB_REPOS_URL = `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100`;
export const GITHUB_EVENTS_URL = `https://api.github.com/users/${GITHUB_USER}/events/public?per_page=100`;
export const PULSE_TTL_MS = 15 * 60 * 1000;
/** After a failed refresh, wait this long before asking GitHub again. */
export const PULSE_RETRY_MS = 60 * 1000;
export const PUSH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const GITHUB_TIMEOUT_MS = 8000;
export const USER_AGENT = "kartikey.fyi";

export interface PulseOptions {
  record: WorkRecord;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Read per refresh; empty means unauthenticated calls. */
  getToken?: () => string | undefined;
  ttlMs?: number;
  retryMs?: number;
  timeoutMs?: number;
  /** Short server-side messages only. */
  log?: (message: string) => void;
}

export interface PulseSource {
  /** Cached pulses, refreshed at most every ttlMs; [] on any failure. */
  getPulses(): Promise<RepoPulse[]>;
}

interface RepoInfo {
  stars: number;
  pushedAt: string | null;
}

function readRepos(repos: unknown): Map<string, RepoInfo> {
  const map = new Map<string, RepoInfo>();
  if (!Array.isArray(repos)) return map;
  for (const item of repos) {
    if (!item || typeof item !== "object") continue;
    const repo = item as { full_name?: unknown; stargazers_count?: unknown; pushed_at?: unknown };
    if (typeof repo.full_name !== "string") continue;
    map.set(repo.full_name.toLowerCase(), {
      stars: typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
      pushedAt: typeof repo.pushed_at === "string" ? repo.pushed_at : null,
    });
  }
  return map;
}

function readPushes(events: unknown, now: number): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(events)) return map;
  const floor = now - PUSH_WINDOW_MS;
  for (const item of events) {
    if (!item || typeof item !== "object") continue;
    const event = item as { type?: unknown; created_at?: unknown; repo?: { name?: unknown } | null };
    if (event.type !== "PushEvent") continue;
    const name = event.repo?.name;
    if (typeof name !== "string") continue;
    const created = typeof event.created_at === "string" ? Date.parse(event.created_at) : NaN;
    if (Number.isNaN(created) || created < floor) continue;
    const key = name.toLowerCase();
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

/** Pure mapping from the two GitHub payloads to pulses; stars without a listed repo are skipped. */
export function mapPulses(record: WorkRecord, repos: unknown, events: unknown, now: number): RepoPulse[] {
  const info = readRepos(repos);
  const pushes = readPushes(events, now);
  const pulses: RepoPulse[] = [];
  for (const star of record.stars) {
    if (!star.repo) continue;
    const key = star.repo.toLowerCase();
    const repo = info.get(key);
    if (!repo) continue;
    pulses.push({
      starId: star.id,
      repo: star.repo,
      stars: repo.stars,
      lastPushAt: repo.pushedAt,
      pushesLast30d: pushes.get(key) ?? 0,
    });
  }
  return pulses;
}

export function createPulseSource(options: PulseOptions): PulseSource {
  const { record } = options;
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const now = options.now ?? (() => Date.now());
  const getToken = options.getToken ?? (() => process.env.GITHUB_TOKEN);
  const ttlMs = options.ttlMs ?? PULSE_TTL_MS;
  const retryMs = options.retryMs ?? PULSE_RETRY_MS;
  const timeoutMs = options.timeoutMs ?? GITHUB_TIMEOUT_MS;
  const log = options.log ?? ((message: string) => console.warn(message));

  let cached: { value: RepoPulse[]; expiresAt: number } | undefined;
  let inflight: Promise<RepoPulse[]> | undefined;

  async function refresh(): Promise<RepoPulse[]> {
    if (!record.stars.some((star) => star.repo)) return [];
    const token = getToken()?.trim();
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const getJson = async (url: string): Promise<unknown> => {
        const response = await fetchImpl(url, { headers, signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
        return response.json();
      };
      const [repos, events] = await Promise.all([getJson(GITHUB_REPOS_URL), getJson(GITHUB_EVENTS_URL)]);
      return mapPulses(record, repos, events, now());
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async getPulses() {
      const t = now();
      if (cached && cached.expiresAt > t) return cached.value;
      if (inflight) return inflight;
      inflight = refresh()
        .then(
          (value) => {
            cached = { value, expiresAt: now() + ttlMs };
            return value;
          },
          (error: unknown) => {
            log(`[pulse] refresh failed: ${error instanceof Error ? error.message : "unknown"}`);
            cached = { value: [], expiresAt: now() + retryMs };
            return [];
          },
        )
        .finally(() => {
          inflight = undefined;
        });
      return inflight;
    },
  };
}
