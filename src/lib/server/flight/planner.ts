// The flight planner: validate, chip, cache, deny list, budgets, model, local.
// Everything is injectable so tests run against a fixture record and a mocked
// fetch. One planner instance holds one cache and one set of budgets, so the
// route module keeps a single instance per server process.

import type { Chip, Facet, FlightPlan, FlightStop, WorkRecord } from "@/lib/contract";
import { DailyBudget, RollingWindowLimiter } from "./budgets";
import { matchChip } from "./chips";
import { isDeniedQuestion } from "./deny";
import { localRoute } from "./local-router";
import { LruCache } from "./lru";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT_MS,
  callOpenRouter,
} from "./openrouter";
import { facetMap, modelSaidNone, parseModelOutput } from "./parse";
import { buildSystemPrompt } from "./prompt";
import { normalizeQuestion } from "./text";
import { EMPTY_PLAN, cleanQuestion } from "./validate";

export interface PlannerOptions {
  record: WorkRecord;
  chips: readonly Chip[];
  /** Read per call so a key added later is picked up; empty means no model. */
  getApiKey?: () => string | undefined;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxTokens?: number;
  now?: () => number;
  perClientLimit?: number;
  perClientWindowMs?: number;
  dailyLimit?: number;
  cacheEntries?: number;
  cacheTtlMs?: number;
  /** Pause model calls after a 429 or 5xx for this long. */
  cooldownMs?: number;
  /** Short server-side messages only; never the question. */
  log?: (message: string) => void;
}

export interface FlightPlanner {
  plan(rawQuestion: unknown, clientKey: string): Promise<FlightPlan>;
}

export const DEFAULTS = {
  perClientLimit: 6,
  perClientWindowMs: 10 * 60 * 1000,
  dailyLimit: 45,
  cacheEntries: 200,
  cacheTtlMs: 24 * 60 * 60 * 1000,
  cooldownMs: 30 * 1000,
} as const;

function copyStops(stops: readonly FlightStop[]): FlightStop[] {
  return stops.map((stop) => ({ starId: stop.starId, facetId: stop.facetId }));
}

export function createFlightPlanner(options: PlannerOptions): FlightPlanner {
  const { record, chips } = options;
  const getApiKey = options.getApiKey ?? (() => process.env.OPENROUTER_API_KEY);
  const model = options.model ?? process.env.OPENROUTER_MODEL?.trim() ?? DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const now = options.now ?? (() => Date.now());
  const cooldownMs = options.cooldownMs ?? DEFAULTS.cooldownMs;
  const log = options.log ?? ((message: string) => console.warn(message));

  const perClient = new RollingWindowLimiter(
    options.perClientLimit ?? DEFAULTS.perClientLimit,
    options.perClientWindowMs ?? DEFAULTS.perClientWindowMs,
  );
  const daily = new DailyBudget(options.dailyLimit ?? DEFAULTS.dailyLimit);
  const cache = new LruCache<string, FlightStop[]>(
    options.cacheEntries ?? DEFAULTS.cacheEntries,
    options.cacheTtlMs ?? DEFAULTS.cacheTtlMs,
    now,
  );
  let cooldownUntil = 0;
  let facets: Map<string, Facet> | undefined;

  function planLocally(question: string, key: string, cacheEmpty: boolean): FlightPlan {
    const stops = localRoute(question, record);
    if (stops.length > 0) {
      cache.set(key, stops);
      return { question, stops, mode: "local" };
    }
    if (cacheEmpty) cache.set(key, []);
    return { question, stops: [], mode: "none" };
  }

  async function planWithModel(question: string, key: string, clientKey: string): Promise<FlightPlan> {
    const apiKey = getApiKey()?.trim();
    if (!apiKey) return planLocally(question, key, false);
    const t = now();
    if (t < cooldownUntil) return planLocally(question, key, false);
    if (!perClient.tryConsume(clientKey, t)) return planLocally(question, key, false);
    if (!daily.tryConsume(t)) return planLocally(question, key, false);

    const result = await callOpenRouter({
      apiKey,
      model,
      systemPrompt: buildSystemPrompt(record),
      question,
      fetchImpl,
      timeoutMs,
      maxTokens,
    });

    if (!result.ok) {
      log(`[flight] model call failed: ${result.reason}${result.status ? ` (${result.status})` : ""}`);
      if (result.reason === "http_429" || result.reason === "http_5xx") {
        cooldownUntil = now() + cooldownMs;
      }
      return planLocally(question, key, false);
    }

    facets ??= facetMap(record.facets);
    const stops = parseModelOutput(result.text, facets);
    if (stops.length > 0) {
      cache.set(key, stops);
      return { question, stops, mode: "model" };
    }
    // A definite NONE from the model is an answer worth remembering; garbage is not.
    return planLocally(question, key, modelSaidNone(result.text));
  }

  return {
    async plan(rawQuestion, clientKey) {
      const question = cleanQuestion(rawQuestion);
      if (question === null) return { ...EMPTY_PLAN, stops: [] };
      try {
        const key = normalizeQuestion(question);
        if (!key) return { question, stops: [], mode: "none" };

        const chip = matchChip(key, chips);
        if (chip) return { question, stops: copyStops(chip.stops), mode: "chip" };

        const cached = cache.get(key);
        if (cached) {
          return cached.length > 0
            ? { question, stops: copyStops(cached), mode: "cache" }
            : { question, stops: [], mode: "none" };
        }

        if (isDeniedQuestion(key)) return { question, stops: [], mode: "none" };

        return await planWithModel(question, key, clientKey);
      } catch (error) {
        log(`[flight] planner error: ${error instanceof Error ? error.name : "unknown"}`);
        const stops = localRoute(question, record);
        return { question, stops, mode: stops.length > 0 ? "local" : "none" };
      }
    },
  };
}
