"use client";

// Client flight state shared by the 3D scene and the UI shell.
//
// The UI agent owns this file. Every exported name stays: the scene reads
// narration, beams, view, answerMode, yearRange, tour, pulses, intro,
// focusedStarId, status, plan and stopIndex, and calls finishIntro() and
// focusStar().
//
// Shape of an answer, in the order the visitor sees it:
//   ask()      status "asking", beams race          -> first sentence lands
//              status "flying", the camera cuts to each sentence's citation
//              done                                  -> answerMode is set
//   askChip()  the same, played locally 900ms apart, never from the network
//   startTour  one curated sentence at a time, on a timer
//
// The machinery (timers, the in-flight request, mirrors of state the timers
// read) lives in an engine created once per provider, so every action is a
// stable function and no effect sets state synchronously.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { z } from "zod";
import {
  MAX_QUESTION_CHARS,
  MAX_SENTENCES,
  MAX_STOPS,
  TIMELINE_END_YEAR,
  TIMELINE_START_YEAR,
  type AnswerMode,
  type AnswerSentence,
  type Chip,
  type ConstellationId,
  type FlightMode,
  type FlightPlan,
  type FlightStop,
  type GeneratedView,
  type RepoPulse,
} from "@/lib/contract";
import { record } from "@/content/record";
import { chips } from "@/content/chips";
import { advocate, tour as tourScript } from "@/content/scripts";

export type FlightStatus = "idle" | "asking" | "flying" | "none";
export type IntroPhase = "pending" | "playing" | "done";

export interface TourState {
  active: boolean;
  index: number;
  /** The visitor paused the timer. */
  paused: boolean;
  total: number;
}

export interface FlightState {
  /** V2 view of the answer: one stop per cited sentence. The scene draws it. */
  plan: FlightPlan | null;
  /** Index into plan.stops of the sentence the camera is on. */
  stopIndex: number;
  /** Star the camera should frame; null means the overview. */
  focusedStarId: string | null;
  /** Facet the card highlights: the landed sentence's citation or a clicked one. */
  focusedFacetId: string | null;
  status: FlightStatus;
  /** The question being asked while status is "asking"; otherwise null. */
  pendingQuestion: string | null;
  /** The question of the current answer, while asking and after. */
  question: string | null;
  /** A short notice after a failed request. It clears itself. */
  error: string | null;
  /** Direction of the last stop change: 1 forward, -1 back. Drives card motion. */
  direction: 1 | -1;
  // ---- V3 signals.
  /** Validated narration sentences, in arrival order. */
  narration: AnswerSentence[];
  /** Index into narration of the sentence the camera is on; -1 for none. */
  activeSentence: number;
  /** True while a scripted answer is still revealing sentences. */
  revealing: boolean;
  /** Star ids lit by thinking beams while status is "asking". */
  beams: string[];
  /** A staged 3D view, or null for the free map. */
  view: GeneratedView | null;
  answerMode: AnswerMode | null;
  /** Inclusive year filter set by the timeline scrubber. */
  yearRange: [number, number];
  tour: TourState;
  /** Live repo activity keyed by star id. */
  pulses: Record<string, RepoPulse>;
  intro: IntroPhase;
}

export interface FlightActions {
  ask(question: string): Promise<void>;
  /** Play a preset chip. Never calls the API. */
  askChip(chip: Chip): void;
  next(): void;
  prev(): void;
  /** Jump to a stop of the current plan by index. */
  goTo(index: number): void;
  /** Fly to a single star, for example when it is clicked. Keeps the narration. */
  focusStar(starId: string): void;
  /** Fly to a cited facet, for example when a citation chip is clicked. */
  focusCitation(stop: FlightStop): void;
  reset(): void;
  dismissError(): void;
  // ---- V3 actions.
  setYearRange(range: [number, number]): void;
  startTour(): void;
  stopTour(): void;
  pauseTour(): void;
  resumeTour(): void;
  nextTourStep(): void;
  prevTourStep(): void;
  /** Called by the scene when the intro animation ends, or by the Skip button. */
  finishIntro(): void;
}

type FlightContextValue = FlightState & FlightActions;

const FlightContext = createContext<FlightContextValue | null>(null);

const REQUEST_TIMEOUT_MS = 20_000;
const ERROR_TTL_MS = 5_000;
const REVEAL_GAP_MS = 900;
const MAX_BEAMS = 8;
const TOUR_TITLE = "A guided tour of the work";
export const INTRO_STORAGE_KEY = "kfyi-intro";

// ------------------------------------------------------------------ record lookups

const starIds = new Set(record.stars.map((star) => star.id));
const facetOwner = new Map(record.facets.map((facet) => [facet.id, facet.starId]));
const facetText = new Map(record.facets.map((facet) => [facet.id, facet.text]));
const constellationIds = record.constellations.map((c) => c.id) as [ConstellationId, ...ConstellationId[]];

function validStop(stop: FlightStop): boolean {
  return starIds.has(stop.starId) && facetOwner.get(stop.facetId) === stop.starId;
}

/** Keep only stops whose star and facet exist and belong together, deduplicated, capped. */
export function sanitizeStops(stops: FlightStop[]): FlightStop[] {
  const seen = new Set<string>();
  const kept: FlightStop[] = [];
  for (const stop of stops) {
    if (!validStop(stop)) continue;
    if (seen.has(stop.facetId)) continue;
    seen.add(stop.facetId);
    kept.push({ starId: stop.starId, facetId: stop.facetId });
    if (kept.length >= MAX_STOPS) break;
  }
  return kept;
}

function cleanCitations(citations: FlightStop[]): FlightStop[] {
  const seen = new Set<string>();
  const kept: FlightStop[] = [];
  for (const stop of citations) {
    if (!validStop(stop) || seen.has(stop.facetId)) continue;
    seen.add(stop.facetId);
    kept.push({ starId: stop.starId, facetId: stop.facetId });
  }
  return kept;
}

/** A sentence survives with its valid citations. Only scripts may say something uncited ("Yes."). */
function cleanSentence(sentence: AnswerSentence, allowUncited: boolean): AnswerSentence | null {
  const text = sentence.text.trim();
  if (!text) return null;
  const citations = cleanCitations(sentence.citations);
  if (citations.length === 0 && !allowUncited) return null;
  return { text, citations };
}

function cleanIds(ids: string[], cap: number): string[] {
  const kept: string[] = [];
  for (const id of ids) {
    if (!starIds.has(id) || kept.includes(id)) continue;
    kept.push(id);
    if (kept.length >= cap) break;
  }
  return kept;
}

function cleanView(view: GeneratedView): GeneratedView | null {
  if (view.kind === "constellation") {
    return constellationIds.includes(view.constellation) ? { kind: "constellation", constellation: view.constellation } : null;
  }
  const ids = cleanIds(view.starIds, 12);
  return ids.length > 0 ? { kind: view.kind, starIds: ids } : null;
}

/** A V2 plan as narration: each stop's line, cited. */
function sentencesFromStops(stops: FlightStop[]): AnswerSentence[] {
  return sanitizeStops(stops).map((stop) => ({
    text: facetText.get(stop.facetId) ?? "",
    citations: [stop],
  }));
}

interface Script {
  sentences: AnswerSentence[];
  view: GeneratedView | null;
  mode: AnswerMode;
}

function normalize(question: string): string {
  return question.toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/, "").trim();
}

function chipScript(chip: Chip): Script {
  const mode: AnswerMode = normalize(chip.question) === normalize(advocate.question) ? "advocate" : "chip";
  const sentences = chip.sentences && chip.sentences.length > 0 ? chip.sentences : sentencesFromStops(chip.stops);
  return { sentences, view: chip.view ?? null, mode };
}

/** The advocate answer and every chip play locally, whatever way they were asked. */
function scriptFor(question: string): Script | null {
  const key = normalize(question);
  if (key === normalize(advocate.question)) {
    return { sentences: advocate.sentences, view: advocate.view ?? null, mode: "advocate" };
  }
  const chip = chips.find((c) => normalize(c.question) === key);
  return chip ? chipScript(chip) : null;
}

function planMode(mode: AnswerMode | null, status: FlightStatus): FlightMode {
  if (status === "none") return "none";
  if (mode === null || mode === "advocate") return mode === "advocate" ? "chip" : "model";
  return mode;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ------------------------------------------------------------------ wire formats

const stopSchema = z.object({ starId: z.string(), facetId: z.string() });
const sentenceSchema = z.object({
  text: z.string().max(600),
  citations: z.array(stopSchema),
});
const idsViewSchema = <K extends "timeline" | "compare" | "stack">(kind: K) =>
  z.object({ kind: z.literal(kind), starIds: z.array(z.string()) });
const viewSchema = z.union([
  idsViewSchema("timeline"),
  idsViewSchema("compare"),
  idsViewSchema("stack"),
  z.object({ kind: z.literal("constellation"), constellation: z.enum(constellationIds) }),
]);
const answerModeSchema = z.enum(["advocate", "chip", "cache", "model", "local", "none"]);
const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("beams"), starIds: z.array(z.string()) }),
  z.object({ type: z.literal("view"), view: viewSchema }),
  z.object({ type: z.literal("say"), sentence: sentenceSchema }),
  z.object({ type: z.literal("done"), mode: answerModeSchema }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
type WireEvent = z.infer<typeof eventSchema>;

const planSchema = z.object({
  question: z.string(),
  stops: z.array(stopSchema),
  mode: z.enum(["chip", "cache", "model", "local", "none"]),
});

const pulsesSchema = z.array(
  z.object({
    starId: z.string(),
    repo: z.string(),
    stars: z.number(),
    lastPushAt: z.string().nullable(),
    pushesLast30d: z.number(),
  }),
);

function parseEvent(line: string): WireEvent | null {
  const text = line.trim();
  if (!text) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = eventSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** Read an NDJSON body line by line, calling back as each line completes. */
async function readLines(body: ReadableStream<Uint8Array>, onLine: (line: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      onLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) onLine(buffer);
}

/** V2 desk, used only while POST /api/answer is missing (404). */
async function fetchLegacyPlan(question: string, signal: AbortSignal): Promise<FlightPlan | null> {
  const res = await fetch("/api/flight", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  });
  if (!res.ok) return null;
  const parsed = planSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : null;
}

// ------------------------------------------------------------------ intro store

// The intro decision is made before hydration by an inline script in the root
// layout, which sets <html data-intro>. This store reads it once on the client,
// serves "pending" on the server, and lets finishIntro() notify subscribers.
const introListeners = new Set<() => void>();
let introPhase: IntroPhase | null = null;

function detectIntro(): IntroPhase {
  const flag = document.documentElement.dataset.intro;
  if (flag === "playing" || flag === "done") return flag;
  try {
    if (prefersReducedMotion()) return "done";
    if (window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "done") return "done";
  } catch {
    return "done";
  }
  return "playing";
}

const introStore = {
  subscribe(listener: () => void) {
    introListeners.add(listener);
    return () => {
      introListeners.delete(listener);
    };
  },
  get(): IntroPhase {
    if (introPhase === null) introPhase = detectIntro();
    return introPhase;
  },
  getServer(): IntroPhase {
    return "pending";
  },
  finish() {
    if (introPhase === "done") return;
    introPhase = "done";
    document.documentElement.dataset.intro = "done";
    try {
      window.sessionStorage.setItem(INTRO_STORAGE_KEY, "done");
    } catch {
      // Private mode or blocked storage: the intro simply plays again next time.
    }
    for (const listener of introListeners) listener();
  },
};

// ------------------------------------------------------------------ engine

interface RunningScript {
  sentences: AnswerSentence[];
  next: number;
  mode: AnswerMode;
}

interface Mem {
  seq: number;
  inflight: AbortController | null;
  narration: AnswerSentence[];
  active: number;
  timers: number[];
  script: RunningScript | null;
  tourActive: boolean;
  tourIndex: number;
  tourPaused: boolean;
  tourTimer: number | null;
}

function createMem(): Mem {
  return {
    seq: 0,
    inflight: null,
    narration: [],
    active: -1,
    timers: [],
    script: null,
    tourActive: false,
    tourIndex: 0,
    tourPaused: false,
    tourTimer: null,
  };
}

interface Setters {
  narration: Dispatch<SetStateAction<AnswerSentence[]>>;
  activeSentence: Dispatch<SetStateAction<number>>;
  revealing: Dispatch<SetStateAction<boolean>>;
  focusedStarId: Dispatch<SetStateAction<string | null>>;
  focusedFacetId: Dispatch<SetStateAction<string | null>>;
  status: Dispatch<SetStateAction<FlightStatus>>;
  pendingQuestion: Dispatch<SetStateAction<string | null>>;
  question: Dispatch<SetStateAction<string | null>>;
  error: Dispatch<SetStateAction<string | null>>;
  direction: Dispatch<SetStateAction<1 | -1>>;
  beams: Dispatch<SetStateAction<string[]>>;
  view: Dispatch<SetStateAction<GeneratedView | null>>;
  answerMode: Dispatch<SetStateAction<AnswerMode | null>>;
  yearRange: Dispatch<SetStateAction<[number, number]>>;
  tour: Dispatch<SetStateAction<TourState>>;
}

const TOUR_TOTAL = tourScript.length;
const INACTIVE_TOUR: TourState = { active: false, index: 0, paused: false, total: TOUR_TOTAL };

function createEngine(set: Setters): FlightActions & { dispose(): void } {
  const m = createMem();

  const clearTimers = () => {
    for (const timer of m.timers) window.clearTimeout(timer);
    m.timers = [];
  };

  const clearTourTimer = () => {
    if (m.tourTimer !== null) window.clearTimeout(m.tourTimer);
    m.tourTimer = null;
  };

  /** Every new action gets a sequence number; a response only lands if it is still the latest. */
  const supersede = () => {
    m.seq += 1;
    m.inflight?.abort();
    m.inflight = null;
    clearTimers();
    m.script = null;
    set.revealing(false);
    return m.seq;
  };

  const setNarration = (list: AnswerSentence[]) => {
    m.narration = list;
    set.narration(list);
  };

  const setActive = (index: number) => {
    m.active = index;
    set.activeSentence(index);
  };

  const focusStop = (stop: FlightStop, sentenceIndex: number) => {
    setActive(sentenceIndex);
    set.focusedStarId(stop.starId);
    set.focusedFacetId(stop.facetId);
  };

  const leaveTour = () => {
    if (!m.tourActive) return;
    clearTourTimer();
    m.tourActive = false;
    m.tourIndex = 0;
    m.tourPaused = false;
    set.tour(INACTIVE_TOUR);
  };

  /** Start over: clears the previous answer and the tour, keeps the year range and pulses. */
  const begin = (question: string | null, status: FlightStatus) => {
    leaveTour();
    setNarration([]);
    setActive(-1);
    set.beams([]);
    set.view(null);
    set.answerMode(null);
    set.error(null);
    set.question(question);
    set.pendingQuestion(status === "asking" ? question : null);
    set.direction(1);
    set.focusedStarId(null);
    set.focusedFacetId(null);
    set.status(status);
  };

  const fail = (message: string) => {
    set.error(message);
    begin(null, "idle");
    set.error(message);
  };

  /** A sentence arrives. The camera cuts to its first citation unless told not to. */
  const land = (sentence: AnswerSentence, focus: boolean) => {
    const index = m.narration.length;
    setNarration([...m.narration, sentence]);
    set.beams([]);
    set.pendingQuestion(null);
    set.status("flying");
    const cite = sentence.citations[0];
    if (cite && focus) {
      set.direction(1);
      focusStop(cite, index);
    }
  };

  const finishScript = () => {
    const script = m.script;
    if (!script) return;
    m.script = null;
    set.answerMode(script.mode);
    set.revealing(false);
  };

  const stepScript = () => {
    const script = m.script;
    if (!script) return;
    land(script.sentences[script.next], true);
    script.next += 1;
    if (script.next >= script.sentences.length) {
      finishScript();
      return;
    }
    m.timers.push(window.setTimeout(stepScript, REVEAL_GAP_MS));
  };

  /** The visitor acted mid-reveal: show the rest at once without moving the camera. */
  const flushScript = () => {
    const script = m.script;
    if (!script) return;
    clearTimers();
    while (script.next < script.sentences.length) {
      land(script.sentences[script.next], false);
      script.next += 1;
    }
    finishScript();
  };

  const playScript = (question: string, script: Script) => {
    supersede();
    const sentences = script.sentences
      .map((sentence) => cleanSentence(sentence, true))
      .filter((sentence): sentence is AnswerSentence => sentence !== null);
    begin(question, "asking");
    if (sentences.length === 0) {
      set.pendingQuestion(null);
      set.answerMode("none");
      set.status("none");
      return;
    }
    set.view(script.view ? cleanView(script.view) : null);
    // A script's mode is known up front, so the panel can frame it ("Yes.") while it reveals.
    set.answerMode(script.mode);
    if (prefersReducedMotion()) {
      setNarration(sentences);
      set.pendingQuestion(null);
      const first = sentences.findIndex((sentence) => sentence.citations.length > 0);
      if (first >= 0) focusStop(sentences[first].citations[0], first);
      set.status("flying");
      set.answerMode(script.mode);
      return;
    }
    m.script = { sentences, next: 0, mode: script.mode };
    set.revealing(true);
    stepScript();
  };

  const playPlan = (question: string, plan: FlightPlan) => {
    playScript(question, { sentences: sentencesFromStops(plan.stops), view: null, mode: plan.mode });
  };

  const ask = async (raw: string) => {
    const question = raw.trim().slice(0, MAX_QUESTION_CHARS);
    if (!question) return;
    const scripted = scriptFor(question);
    if (scripted) {
      playScript(question, scripted);
      return;
    }

    const seq = supersede();
    const controller = new AbortController();
    m.inflight = controller;
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    begin(question, "asking");
    const live = () => seq === m.seq;

    let landed = 0;
    let mode: AnswerMode | null = null;
    let problem: string | null = null;
    let legacy: FlightPlan | null | undefined;

    const handle = (event: WireEvent) => {
      switch (event.type) {
        case "beams":
          set.beams(cleanIds(event.starIds, MAX_BEAMS));
          break;
        case "view":
          set.view(cleanView(event.view));
          break;
        case "say": {
          if (landed >= MAX_SENTENCES) break;
          const sentence = cleanSentence(event.sentence, false);
          if (!sentence) break;
          landed += 1;
          land(sentence, true);
          break;
        }
        case "done":
          mode = event.mode;
          set.beams([]);
          break;
        case "error":
          problem = event.message;
          break;
      }
    };

    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/x-ndjson" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });
      if (!live()) return;
      if (res.status === 404 || res.status === 405) {
        legacy = await fetchLegacyPlan(question, controller.signal);
      } else if (res.status === 400) {
        problem = "That question can't be asked as written. Try fewer than 200 characters.";
      } else if (!res.ok || !res.body) {
        problem = "The answer desk didn't answer. Try again, or pick a question below.";
      } else {
        await readLines(res.body, (line) => {
          if (!live()) return;
          const event = parseEvent(line);
          if (event) handle(event);
        });
      }
    } catch {
      if (!controller.signal.aborted) {
        problem = "Couldn't reach the answer desk. Check your connection and try again.";
      } else if (landed === 0) {
        problem = "No answer in time. Try again, or pick a question below.";
      }
    } finally {
      window.clearTimeout(timer);
    }

    if (!live()) return;
    m.inflight = null;

    if (legacy !== undefined) {
      if (legacy) playPlan(question, legacy);
      else fail("The answer desk didn't answer. Try again, or pick a question below.");
      return;
    }
    if (landed > 0) {
      set.beams([]);
      set.answerMode(mode ?? "model");
      return;
    }
    if (mode === "none" || (mode !== null && landed === 0)) {
      set.beams([]);
      set.pendingQuestion(null);
      set.answerMode("none");
      set.status("none");
      return;
    }
    fail(problem ?? "The answer desk sent nothing back. Try again.");
  };

  const askChip = (chip: Chip) => {
    playScript(chip.question, chipScript(chip));
  };

  /** Narration indices of the sentences that cite something: the stops. */
  const citedIndices = () => m.narration.flatMap((sentence, i) => (sentence.citations.length > 0 ? [i] : []));

  const goTo = (stopIndex: number) => {
    const cited = citedIndices();
    if (cited.length === 0) return;
    const clamped = Math.max(0, Math.min(stopIndex, cited.length - 1));
    const sentenceIndex = cited[clamped];
    if (sentenceIndex === m.active) return;
    if (m.script) flushScript();
    set.direction(sentenceIndex > m.active ? 1 : -1);
    set.error(null);
    focusStop(m.narration[sentenceIndex].citations[0], sentenceIndex);
    set.status("flying");
  };

  const currentStop = () => citedIndices().indexOf(m.active);

  const next = () => goTo(currentStop() + 1);
  const prev = () => {
    const current = currentStop();
    goTo(current <= 0 ? 0 : current - 1);
  };

  const pauseTour = () => {
    if (!m.tourActive || m.tourPaused) return;
    clearTourTimer();
    m.tourPaused = true;
    set.tour((t) => ({ ...t, paused: true }));
  };

  const focusStar = (starId: string) => {
    if (!starIds.has(starId)) return;
    if (m.inflight) {
      // A model stream is still arriving: the click wins, what arrived stays.
      m.seq += 1;
      m.inflight.abort();
      m.inflight = null;
      set.beams([]);
      set.pendingQuestion(null);
      if (m.narration.length > 0) set.answerMode("model");
    }
    if (m.script) flushScript();
    if (m.tourActive) pauseTour();
    // Prefer the facet a sentence cites for this star, so the card and the narration agree.
    let sentenceIndex = -1;
    let facetId: string | null = null;
    m.narration.forEach((sentence, i) => {
      if (sentenceIndex >= 0) return;
      const cite = sentence.citations.find((c) => c.starId === starId);
      if (cite) {
        sentenceIndex = i;
        facetId = cite.facetId;
      }
    });
    if (m.narration.length === 0) set.question(null);
    set.direction(1);
    set.error(null);
    setActive(sentenceIndex);
    set.focusedStarId(starId);
    set.focusedFacetId(facetId);
    set.status("flying");
  };

  const focusCitation = (stop: FlightStop) => {
    if (!validStop(stop)) return;
    if (m.script) flushScript();
    if (m.tourActive) pauseTour();
    let sentenceIndex = -1;
    m.narration.forEach((sentence, i) => {
      if (sentenceIndex < 0 && sentence.citations.some((c) => c.facetId === stop.facetId)) sentenceIndex = i;
    });
    set.direction(sentenceIndex >= m.active ? 1 : -1);
    set.error(null);
    focusStop(stop, sentenceIndex);
    set.status("flying");
  };

  const reset = () => {
    supersede();
    begin(null, "idle");
  };

  const dismissError = () => set.error(null);

  const setYearRange = ([a, b]: [number, number]) => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    const clamp = (year: number) => Math.max(TIMELINE_START_YEAR, Math.min(TIMELINE_END_YEAR, Math.round(year)));
    let lo = clamp(a);
    let hi = clamp(b);
    if (lo > hi) [lo, hi] = [hi, lo];
    set.yearRange((current) => (current[0] === lo && current[1] === hi ? current : [lo, hi]));
  };

  // ---- tour

  const scheduleTour = (index: number) => {
    clearTourTimer();
    const hold = Math.max(1500, tourScript[index]?.holdMs ?? 5000);
    m.tourTimer = window.setTimeout(() => {
      m.tourTimer = null;
      advanceTour(index + 1);
    }, hold);
  };

  const showTourStep = (index: number, paused: boolean) => {
    const step = tourScript[index];
    if (!step) return;
    const sentence = cleanSentence(step.sentence, true) ?? { text: step.sentence.text, citations: [] };
    m.tourActive = true;
    m.tourIndex = index;
    m.tourPaused = paused;
    setNarration([sentence]);
    set.beams([]);
    set.view(null);
    set.answerMode(null);
    set.pendingQuestion(null);
    set.error(null);
    set.tour({ active: true, index, paused, total: TOUR_TOTAL });
    const cite = sentence.citations[0];
    if (cite) focusStop(cite, 0);
    else {
      setActive(0);
      set.focusedStarId(null);
      set.focusedFacetId(null);
    }
    set.status("flying");
    if (paused) clearTourTimer();
    else scheduleTour(index);
  };

  const stopTour = () => {
    if (!m.tourActive) return;
    supersede();
    begin(null, "idle");
  };

  const advanceTour = (index: number) => {
    if (!m.tourActive) return;
    if (index >= TOUR_TOTAL) {
      stopTour();
      return;
    }
    set.direction(1);
    showTourStep(index, false);
  };

  const startTour = () => {
    if (TOUR_TOTAL === 0) return;
    supersede();
    begin(TOUR_TITLE, "asking");
    showTourStep(0, false);
  };

  const resumeTour = () => {
    if (!m.tourActive || !m.tourPaused) return;
    m.tourPaused = false;
    set.tour((t) => ({ ...t, paused: false }));
    scheduleTour(m.tourIndex);
  };

  const nextTourStep = () => {
    if (!m.tourActive) return;
    const index = m.tourIndex + 1;
    if (index >= TOUR_TOTAL) {
      stopTour();
      return;
    }
    set.direction(1);
    showTourStep(index, m.tourPaused);
  };

  const prevTourStep = () => {
    if (!m.tourActive) return;
    set.direction(-1);
    showTourStep(Math.max(0, m.tourIndex - 1), m.tourPaused);
  };

  const finishIntro = () => introStore.finish();

  const dispose = () => {
    m.inflight?.abort();
    m.inflight = null;
    clearTimers();
    clearTourTimer();
  };

  return {
    ask,
    askChip,
    next,
    prev,
    goTo,
    focusStar,
    focusCitation,
    reset,
    dismissError,
    setYearRange,
    startTour,
    stopTour,
    pauseTour,
    resumeTour,
    nextTourStep,
    prevTourStep,
    finishIntro,
    dispose,
  };
}

// ------------------------------------------------------------------ provider

export function FlightProvider({ children }: { children: ReactNode }) {
  const [narration, setNarration] = useState<AnswerSentence[]>([]);
  const [activeSentence, setActiveSentence] = useState(-1);
  const [revealing, setRevealing] = useState(false);
  const [focusedStarId, setFocusedStarId] = useState<string | null>(null);
  const [focusedFacetId, setFocusedFacetId] = useState<string | null>(null);
  const [status, setStatus] = useState<FlightStatus>("idle");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [beams, setBeams] = useState<string[]>([]);
  const [view, setView] = useState<GeneratedView | null>(null);
  const [answerMode, setAnswerMode] = useState<AnswerMode | null>(null);
  const [yearRange, setYearRange] = useState<[number, number]>([TIMELINE_START_YEAR, TIMELINE_END_YEAR]);
  const [tour, setTour] = useState<TourState>(INACTIVE_TOUR);
  const [pulses, setPulses] = useState<Record<string, RepoPulse>>({});
  const intro = useSyncExternalStore(introStore.subscribe, introStore.get, introStore.getServer);

  // Created once. The engine owns its timers and request; React only sees state.
  const [engine] = useState(() =>
    createEngine({
      narration: setNarration,
      activeSentence: setActiveSentence,
      revealing: setRevealing,
      focusedStarId: setFocusedStarId,
      focusedFacetId: setFocusedFacetId,
      status: setStatus,
      pendingQuestion: setPendingQuestion,
      question: setQuestion,
      error: setError,
      direction: setDirection,
      beams: setBeams,
      view: setView,
      answerMode: setAnswerMode,
      yearRange: setYearRange,
      tour: setTour,
    }),
  );

  useEffect(() => () => engine.dispose(), [engine]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), ERROR_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [error]);

  // Live repo activity, once. Any failure (including a missing route) leaves it empty.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pulse", { signal: controller.signal, headers: { accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const parsed = pulsesSchema.safeParse(json);
        if (!parsed.success) return;
        const byStar: Record<string, RepoPulse> = {};
        for (const pulse of parsed.data) if (starIds.has(pulse.starId)) byStar[pulse.starId] = pulse;
        setPulses(byStar);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const stops = useMemo(
    () => narration.flatMap((sentence) => (sentence.citations.length > 0 ? [sentence.citations[0]] : [])),
    [narration],
  );

  const stopIndex = useMemo(() => {
    if (activeSentence < 0) return 0;
    let count = 0;
    for (let i = 0; i < narration.length && i <= activeSentence; i += 1) {
      if (narration[i].citations.length > 0) count += 1;
    }
    return Math.max(0, count - 1);
  }, [narration, activeSentence]);

  const plan = useMemo<FlightPlan | null>(() => {
    if (!question) return null;
    if (narration.length === 0 && status !== "none") return null;
    return { question, stops, mode: planMode(answerMode, status) };
  }, [question, narration, stops, status, answerMode]);

  const value = useMemo<FlightContextValue>(
    () => ({
      plan,
      stopIndex,
      focusedStarId,
      focusedFacetId,
      status,
      pendingQuestion,
      question,
      error,
      direction,
      narration,
      activeSentence,
      revealing,
      beams,
      view,
      answerMode,
      yearRange,
      tour,
      pulses,
      intro,
      ask: engine.ask,
      askChip: engine.askChip,
      next: engine.next,
      prev: engine.prev,
      goTo: engine.goTo,
      focusStar: engine.focusStar,
      focusCitation: engine.focusCitation,
      reset: engine.reset,
      dismissError: engine.dismissError,
      setYearRange: engine.setYearRange,
      startTour: engine.startTour,
      stopTour: engine.stopTour,
      pauseTour: engine.pauseTour,
      resumeTour: engine.resumeTour,
      nextTourStep: engine.nextTourStep,
      prevTourStep: engine.prevTourStep,
      finishIntro: engine.finishIntro,
    }),
    [
      plan,
      stopIndex,
      focusedStarId,
      focusedFacetId,
      status,
      pendingQuestion,
      question,
      error,
      direction,
      narration,
      activeSentence,
      revealing,
      beams,
      view,
      answerMode,
      yearRange,
      tour,
      pulses,
      intro,
      engine,
    ],
  );

  return <FlightContext.Provider value={value}>{children}</FlightContext.Provider>;
}

export function useFlight(): FlightContextValue {
  const value = useContext(FlightContext);
  if (!value) throw new Error("useFlight must be used inside FlightProvider");
  return value;
}
