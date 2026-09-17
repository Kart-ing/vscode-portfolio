// The answer pipeline, PRD steps 1-9: validate, deny, advocate, chip, vague,
// cache, beams, model stream, local fallback. It is an async generator so the
// handler can write each event the moment it exists. Everything is injectable
// so tests run against a fixture record and a mocked fetch. One instance holds
// one cache and one set of budgets, shared with nothing else.

import {
  MAX_STOPS,
  type AnswerEvent,
  type AnswerMode,
  type Chip,
  type ScriptedAnswer,
  type WorkRecord,
} from "@/lib/contract";
import { DailyBudget, RollingWindowLimiter } from "@/lib/server/flight/budgets";
import { matchChip } from "@/lib/server/flight/chips";
import { isDeniedQuestion } from "@/lib/server/flight/deny";
import { LruCache } from "@/lib/server/flight/lru";
import { DEFAULTS } from "@/lib/server/flight/planner";
import { modelChainFromEnv, resolveModelChain } from "@/lib/server/models";
import { normalizeQuestion } from "@/lib/server/flight/text";
import { cleanQuestion } from "@/lib/server/flight/validate";
import { isAdvocateQuestion, isVagueQuestion } from "./intent";
import { beamsFor, localAnswerStops } from "./local";
import {
  DEFAULT_STREAM_MAX_TOKENS,
  DEFAULT_STREAM_TIMEOUT_MS,
  ModelStreamError,
  streamOpenRouter,
} from "./openrouter-stream";
import { buildAnswerPrompt } from "./prompt";
import { buildTruthIndex, isLeakedPhrasing, ProtocolValidator } from "./protocol";
import { chipEvents, scriptedEvents } from "./scripted";
import { LineSplitter } from "./sse";
import { stackTermsIn } from "./stack-terms";

export interface AnswererOptions {
  record: WorkRecord;
  chips: readonly Chip[];
  /** The scripted "Yes." answer for hire/back/invest questions. */
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
  const truth = buildTruthIndex(record);

  /** One sentence per routed facet: the facet's own text with its citation. */
  function localEvents(question: string): AnswerEvent[] {
    const events: AnswerEvent[] = [];
    for (const stop of localAnswerStops(question, record).slice(0, MAX_STOPS)) {
      const facet = truth.facets.get(stop.facetId);
      // The router already prefers a sibling facet; this keeps a lone tagline facet out too.
      if (!facet || isLeakedPhrasing(facet.text)) continue;
      events.push({
        type: "say",
        sentence: { text: facet.text, citations: [{ starId: stop.starId, facetId: stop.facetId }] },
      });
    }
    return events;
  }

  /** Yields validated view/say events from the model; yields nothing when the model is unavailable. */
  async function* streamModel(
    question: string,
    clientKey: string,
    signal: AbortSignal | undefined,
  ): AsyncGenerator<AnswerEvent, void, undefined> {
    const apiKey = getApiKey()?.trim();
    if (!apiKey) return;
    const t = now();
    if (t < cooldownUntil) return;
    if (!perClient.tryConsume(clientKey, t)) return;
    if (!daily.tryConsume(t)) return;

    // A named technology in the question pins every sentence to stars or
    // facets that carry it.
    const validator = new ProtocolValidator(truth, {
      stackTerms: stackTermsIn(normalizeQuestion(question), truth.vocabulary),
    });
    const lines = new LineSplitter();
    try {
      for await (const delta of streamOpenRouter({
        apiKey,
        models,
        systemPrompt: buildAnswerPrompt(record),
        question,
        fetchImpl,
        timeoutMs,
        maxTokens,
        signal,
        onModel: (answered) => log(`[answer] answered by ${answered}`),
      })) {
        for (const line of lines.push(delta)) {
          for (const event of validator.accept(line)) yield event;
          if (validator.done) return;
        }
      }
      const tail = lines.flush();
      if (tail !== null) for (const event of validator.accept(tail)) yield event;
    } catch (error) {
      const reason = error instanceof ModelStreamError ? error.reason : "unknown";
      const status = error instanceof ModelStreamError && error.status ? ` (${error.status})` : "";
      log(`[answer] model stream failed: ${reason}${status}`);
      if (reason === "http_429" || reason === "http_5xx") cooldownUntil = now() + cooldownMs;
    }
  }

  return {
    async *answer(rawQuestion, clientKey, signal) {
      const question = cleanQuestion(rawQuestion);
      if (question === null) {
        yield { type: "error", message: INVALID_QUESTION_MESSAGE };
        yield done("none");
        return;
      }
      let said = false;
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
          for (const event of chipEvents(chip, truth.facets)) yield event;
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

        yield { type: "beams", starIds: beamsFor(question, record) };

        const events: AnswerEvent[] = [];
        for await (const event of streamModel(question, clientKey, signal)) {
          events.push(event);
          if (event.type === "say") said = true;
          yield event;
        }
        if (said) {
          events.push(done("model"));
          cache.set(key, events);
          yield done("model");
          return;
        }

        const local = localEvents(question);
        if (local.length > 0) {
          cache.set(key, [...events, ...local, done("local")]);
          for (const event of local) yield event;
          yield done("local");
          return;
        }

        for (const event of scriptedEvents(highlights)) yield event;
        yield done("local");
      } catch (error) {
        log(`[answer] pipeline error: ${error instanceof Error ? error.name : "unknown"}`);
        if (said) {
          yield done("model");
          return;
        }
        let fallback: AnswerEvent[] = [];
        try {
          fallback = localEvents(question);
        } catch {
          fallback = [];
        }
        for (const event of fallback) yield event;
        yield done(fallback.length > 0 ? "local" : "none");
      }
    },
  };
}
