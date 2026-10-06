// The answer pipeline: validate, deny, the "What has Kartikey built?" lines
// for hire, back and invest questions, chips, greetings, cache, then the
// relevance gate (gate.ts) and the extractive model path.
//
// Invariant I1 (the owner's one-story PRD, 6 Oct 2026): every sentence this
// yields is a facet's own text citing that facet, or a curated sentence from
// scripts.ts or chips.ts. The model never writes text. For a typed question
// the gate computes the candidate set first, with no model involved; the model
// may only pick ids from it, and the server drops every other id. When no id
// survives, or the model is off, slow or failing, the router's own answer is
// shown, drawn from the same set; when the set is empty the answer is none,
// and the page shows its no-answer line.
//
// It is an async generator so the handler can write each event the moment it
// exists. Everything is injectable so tests run against a fixture record and
// a mocked fetch. One instance holds one cache and one set of budgets, shared
// with nothing else.

import type { AnswerEvent, AnswerMode, Chip, Facet, FlightStop, ScriptedAnswer, WorkRecord } from "@/lib/contract";
import { DailyBudget, RollingWindowLimiter } from "@/lib/server/flight/budgets";
import { matchChip } from "@/lib/server/flight/chips";
import { isDeniedQuestion } from "@/lib/server/flight/deny";
import { LruCache } from "@/lib/server/flight/lru";
import { DEFAULTS } from "@/lib/server/flight/planner";
import { modelChainFromEnv, resolveModelChain } from "@/lib/server/models";
import { normalizeQuestion } from "@/lib/server/flight/text";
import { cleanQuestion } from "@/lib/server/flight/validate";
import { answerCandidates, type Candidates } from "./gate";
import { isAdvocateQuestion, isVagueQuestion } from "./intent";
import { MAX_BEAMS } from "./local";
import {
  DEFAULT_STREAM_MAX_TOKENS,
  DEFAULT_STREAM_TIMEOUT_MS,
  ModelStreamError,
  streamOpenRouter,
} from "./openrouter-stream";
import { EXTRACT_RULES, buildCandidateMessage } from "./prompt";
import { MAX_MODEL_OUTPUT_CHARS, gateIds, parseModelIds } from "./protocol";
import { chipEvents, scriptedEvents } from "./scripted";

export interface AnswererOptions {
  record: WorkRecord;
  chips: readonly Chip[];
  /** "What has Kartikey built?": the cited lines hire, back and invest questions get. */
  advocate: ScriptedAnswer;
  /** The scripted answer for greetings and vague questions. */
  highlights: ScriptedAnswer;
  /** Read per call so a key added later is picked up; empty means no model. */
  getApiKey?: () => string | undefined;
  model?: string;
  /** Priority-ordered fallback chain; only ":free" ids survive. Defaults to the env or DEFAULT_MODELS. */
  models?: readonly string[];
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

export interface Answerer {
  /**
   * Streams the events for one question. The last event is always `done`.
   * `signal` lets the caller stop an in-flight model call when the client leaves.
   */
  answer(rawQuestion: unknown, clientKey: string, signal?: AbortSignal): AsyncGenerator<AnswerEvent, void, undefined>;
}

export const INVALID_QUESTION_MESSAGE = "Ask a question of 1 to 200 characters.";

const done = (mode: AnswerMode): AnswerEvent => ({ type: "done", mode });

const NO_CANDIDATES: Candidates = { candidates: [], answer: [] };

export function createAnswerer(options: AnswererOptions): Answerer {
  const { record, chips, advocate, highlights } = options;
  const getApiKey = options.getApiKey ?? (() => process.env.OPENROUTER_API_KEY);
  // Free models only; a paid id in the options or the env is dropped.
  const models = options.models
    ? resolveModelChain(options.models)
    : options.model
      ? resolveModelChain(options.model)
      : modelChainFromEnv();
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS;
  const maxTokens = options.maxTokens ?? DEFAULT_STREAM_MAX_TOKENS;
  const now = options.now ?? (() => Date.now());
  const cooldownMs = options.cooldownMs ?? DEFAULTS.cooldownMs;
  const log = options.log ?? ((message: string) => console.warn(message));

  const perClient = new RollingWindowLimiter(
    options.perClientLimit ?? DEFAULTS.perClientLimit,
    options.perClientWindowMs ?? DEFAULTS.perClientWindowMs,
  );
  const daily = new DailyBudget(options.dailyLimit ?? DEFAULTS.dailyLimit);
  const cache = new LruCache<string, AnswerEvent[]>(
    options.cacheEntries ?? DEFAULTS.cacheEntries,
    options.cacheTtlMs ?? DEFAULTS.cacheTtlMs,
    now,
  );
  let cooldownUntil = 0;
  const stars = new Set(record.stars.map((star) => star.id));
  const facets = new Map<string, Facet>();
  for (const facet of record.facets) if (stars.has(facet.starId)) facets.set(facet.id, facet);

  /** One sentence per stop: the facet's own text, citing that facet. Nothing else is ever said here. */
  function sayFacets(stops: readonly FlightStop[]): AnswerEvent[] {
    const events: AnswerEvent[] = [];
    for (const stop of stops) {
      const facet = facets.get(stop.facetId);
      if (!facet || facet.starId !== stop.starId) continue;
      events.push({
        type: "say",
        sentence: { text: facet.text, citations: [{ starId: facet.starId, facetId: facet.id }] },
      });
    }
    return events;
  }

  /**
   * The candidate ids the model picked, after the gate. Empty when the model
   * is off, over budget, cooling down, failing or timing out, or when nothing
   * it returned is a candidate.
   */
  async function pickWithModel(
    question: string,
    candidates: readonly FlightStop[],
    clientKey: string,
    signal: AbortSignal | undefined,
  ): Promise<FlightStop[]> {
    const apiKey = getApiKey()?.trim();
    if (!apiKey) return [];
    const t = now();
    if (t < cooldownUntil) return [];
    if (!perClient.tryConsume(clientKey, t)) return [];
    if (!daily.tryConsume(t)) return [];

    let output = "";
    let ids: string[] | null = null;
    try {
      for await (const delta of streamOpenRouter({
        apiKey,
        models,
        systemPrompt: EXTRACT_RULES,
        question: buildCandidateMessage(question, candidates, record),
        fetchImpl,
        timeoutMs,
        maxTokens,
        signal,
        onModel: (answered) => log(`[answer] answered by ${answered}`),
      })) {
        output += delta;
        // Stop reading at the first complete ids object; whatever follows is never used.
        if (delta.includes("}")) ids = parseModelIds(output);
        if (ids !== null || output.length >= MAX_MODEL_OUTPUT_CHARS) break;
      }
    } catch (error) {
      const reason = error instanceof ModelStreamError ? error.reason : "unknown";
      const status = error instanceof ModelStreamError && error.status ? ` (${error.status})` : "";
      log(`[answer] model stream failed: ${reason}${status}`);
      if (reason === "http_429" || reason === "http_5xx") cooldownUntil = now() + cooldownMs;
      return [];
    }
    ids ??= parseModelIds(output);
    if (ids === null) {
      log("[answer] model output held no ids object");
      return [];
    }
    const byId = new Map(candidates.map((stop) => [stop.facetId, stop]));
    const kept = gateIds(ids, new Set(byId.keys()));
    if (kept.length < ids.length) log(`[answer] gate dropped ${ids.length - kept.length} of ${ids.length} ids`);
    return kept.map((id) => byId.get(id)!);
  }

  return {
    async *answer(rawQuestion, clientKey, signal) {
      const question = cleanQuestion(rawQuestion);
      if (question === null) {
        yield { type: "error", message: INVALID_QUESTION_MESSAGE };
        yield done("none");
        return;
      }
      /** The mode whose sentences already went out, if any. */
      let spoke: AnswerMode | null = null;
      let gated = NO_CANDIDATES;
      try {
        const key = normalizeQuestion(question);
        if (!key || isDeniedQuestion(key)) {
          yield done("none");
          return;
        }

        if (isAdvocateQuestion(key) && advocate.sentences.length > 0) {
          for (const event of scriptedEvents(advocate)) yield event;
          yield done("advocate");
          return;
        }

        const chip = matchChip(key, chips);
        if (chip) {
          for (const event of chipEvents(chip, facets)) yield event;
          yield done("chip");
          return;
        }

        if (isVagueQuestion(key) && highlights.sentences.length > 0) {
          for (const event of scriptedEvents(highlights)) yield event;
          yield done("local");
          return;
        }

        const cached = cache.get(key);
        if (cached) {
          for (const event of cached) yield event.type === "done" ? done("cache") : event;
          return;
        }

        // The relevance gate: the router's candidates, before any model call.
        gated = answerCandidates(question, record);
        if (gated.candidates.length === 0) {
          yield done("none");
          return;
        }
        yield { type: "beams", starIds: [...new Set(gated.candidates.map((c) => c.starId))].slice(0, MAX_BEAMS) };

        const picked = sayFacets(await pickWithModel(question, gated.candidates, clientKey, signal));
        if (picked.length > 0) {
          cache.set(key, [...picked, done("model")]);
          spoke = "model";
          for (const event of picked) yield event;
          yield done("model");
          return;
        }

        const local = sayFacets(gated.answer);
        if (local.length === 0) {
          yield done("none");
          return;
        }
        cache.set(key, [...local, done("local")]);
        spoke = "local";
        for (const event of local) yield event;
        yield done("local");
      } catch (error) {
        log(`[answer] pipeline error: ${error instanceof Error ? error.name : "unknown"}`);
        if (spoke) {
          yield done(spoke);
          return;
        }
        // Only the router's own answer, recomputed if the gate never ran.
        let fallback: AnswerEvent[] = [];
        try {
          const answer = gated.candidates.length > 0 ? gated.answer : answerCandidates(question, record).answer;
          fallback = sayFacets(answer);
        } catch {
          fallback = [];
        }
        for (const event of fallback) yield event;
        yield done(fallback.length > 0 ? "local" : "none");
      }
    },
  };
}
