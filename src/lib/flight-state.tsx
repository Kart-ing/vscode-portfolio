"use client";

// Client flight state shared by the 3D scene and the UI shell.
// The UI agent owns this file and may add fields and actions,
// but must keep every name below so the scene agent's code keeps working.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";
import {
  MAX_QUESTION_CHARS,
  MAX_STOPS,
  TIMELINE_END_YEAR,
  TIMELINE_START_YEAR,
  type AnswerMode,
  type AnswerSentence,
  type Chip,
  type FlightPlan,
  type FlightStop,
  type GeneratedView,
  type RepoPulse,
} from "@/lib/contract";
import { record } from "@/content/record";

export type FlightStatus = "idle" | "asking" | "flying" | "none";
export type IntroPhase = "pending" | "playing" | "done";

export interface FlightState {
  plan: FlightPlan | null;
  stopIndex: number;
  /** Star the camera should frame; null means the overview. */
  focusedStarId: string | null;
  status: FlightStatus;
  /** The question being asked while status is "asking"; otherwise null. */
  pendingQuestion: string | null;
  /** A short notice after a failed request. It clears itself. */
  error: string | null;
  /** Direction of the last stop change: 1 forward, -1 back. Drives card motion. */
  direction: 1 | -1;
  // ---- V3 signals. The UI agent implements them; the scene agent reads them.
  /** Validated narration sentences, in arrival order. */
  narration: AnswerSentence[];
  /** Star ids lit by thinking beams while status is "asking". */
  beams: string[];
  /** A staged 3D view, or null for the free map. */
  view: GeneratedView | null;
  answerMode: AnswerMode | null;
  /** Inclusive year filter set by the timeline scrubber. */
  yearRange: [number, number];
  tour: { active: boolean; index: number };
  /** Live repo activity keyed by star id. */
  pulses: Record<string, RepoPulse>;
  intro: IntroPhase;
}

export interface FlightActions {
  ask(question: string): Promise<void>;
  /** Fly a preset chip. Never calls the API. */
  askChip(chip: Chip): void;
  next(): void;
  prev(): void;
  /** Jump to a stop of the current plan by index. */
  goTo(index: number): void;
  /** Fly to a single star outside a plan, for example when it is clicked. */
  focusStar(starId: string): void;
  reset(): void;
  dismissError(): void;
  // ---- V3 actions.
  setYearRange(range: [number, number]): void;
  startTour(): void;
  stopTour(): void;
  /** Called by the scene when the intro animation ends, or by the Skip button. */
  finishIntro(): void;
}

type FlightContextValue = FlightState & FlightActions;

const FlightContext = createContext<FlightContextValue | null>(null);

const REQUEST_TIMEOUT_MS = 15_000;
const ERROR_TTL_MS = 5_000;

const planSchema = z.object({
  question: z.string(),
  stops: z.array(z.object({ starId: z.string(), facetId: z.string() })),
  mode: z.enum(["chip", "cache", "model", "local", "none"]),
});

const starIds = new Set(record.stars.map((star) => star.id));
const facetOwner = new Map(record.facets.map((facet) => [facet.id, facet.starId]));

/** Keep only stops whose star and facet exist and belong together, deduplicated, capped. */
export function sanitizeStops(stops: FlightStop[]): FlightStop[] {
  const seen = new Set<string>();
  const kept: FlightStop[] = [];
  for (const stop of stops) {
    if (!starIds.has(stop.starId)) continue;
    if (facetOwner.get(stop.facetId) !== stop.starId) continue;
    if (seen.has(stop.facetId)) continue;
    seen.add(stop.facetId);
    kept.push({ starId: stop.starId, facetId: stop.facetId });
    if (kept.length >= MAX_STOPS) break;
  }
  return kept;
}

export function FlightProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<FlightPlan | null>(null);
  const [stopIndex, setStopIndex] = useState(0);
  const [focusedStarId, setFocusedStarId] = useState<string | null>(null);
  const [status, setStatus] = useState<FlightStatus>("idle");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  // V3 signals: defaults only. The UI agent wires real behavior.
  const [narration] = useState<AnswerSentence[]>([]);
  const [beams] = useState<string[]>([]);
  const [view] = useState<GeneratedView | null>(null);
  const [answerMode] = useState<AnswerMode | null>(null);
  const [yearRange, setYearRange] = useState<[number, number]>([TIMELINE_START_YEAR, TIMELINE_END_YEAR]);
  const [tour, setTour] = useState<{ active: boolean; index: number }>({ active: false, index: 0 });
  const [pulses] = useState<Record<string, RepoPulse>>({});
  const [intro, setIntro] = useState<IntroPhase>("pending");

  // Every ask gets a sequence number; a response only lands if it is still the latest.
  const sequence = useRef(0);
  const inflight = useRef<AbortController | null>(null);

  const supersede = useCallback(() => {
    sequence.current += 1;
    inflight.current?.abort();
    inflight.current = null;
    return sequence.current;
  }, []);

  const applyPlan = useCallback((next: FlightPlan) => {
    const stops = sanitizeStops(next.stops);
    const mode = stops.length === 0 ? "none" : next.mode;
    setPlan({ question: next.question, stops, mode });
    setStopIndex(0);
    setDirection(1);
    setPendingQuestion(null);
    setError(null);
    if (stops.length === 0) {
      setFocusedStarId(null);
      setStatus("none");
      return;
    }
    setFocusedStarId(stops[0].starId);
    setStatus("flying");
  }, []);

  const fail = useCallback((message: string) => {
    setError(message);
    setPendingQuestion(null);
    setPlan(null);
    setStopIndex(0);
    setFocusedStarId(null);
    setStatus("idle");
  }, []);

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim().slice(0, MAX_QUESTION_CHARS);
      if (!question) return;
      const seq = supersede();
      const controller = new AbortController();
      inflight.current = controller;
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      setError(null);
      setPendingQuestion(question);
      setStatus("asking");

      let next: FlightPlan | null = null;
      let problem: string | null = null;
      try {
        const res = await fetch("/api/flight", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        });
        if (res.status === 400) {
          problem = "That question can't be asked as written. Try fewer than 200 characters.";
        } else if (!res.ok) {
          problem = "The flight desk didn't answer. Try again, or pick a question below.";
        } else {
          const parsed = planSchema.safeParse(await res.json());
          if (parsed.success) next = parsed.data;
          else problem = "The flight desk sent something unreadable. Try again.";
        }
      } catch {
        problem = controller.signal.aborted
          ? "No answer in time. Try again, or pick a question below."
          : "Couldn't reach the flight desk. Check your connection and try again.";
      } finally {
        clearTimeout(timer);
      }

      if (seq !== sequence.current) return; // a newer action superseded this one
      inflight.current = null;
      if (next) applyPlan({ ...next, question });
      else fail(problem ?? "Something went wrong. Try again.");
    },
    [applyPlan, fail, supersede],
  );

  const askChip = useCallback(
    (chip: Chip) => {
      supersede();
      applyPlan({ question: chip.question, stops: chip.stops, mode: "chip" });
    },
    [applyPlan, supersede],
  );

  const goTo = useCallback(
    (index: number) => {
      if (!plan || plan.stops.length === 0) return;
      const clamped = Math.max(0, Math.min(index, plan.stops.length - 1));
      if (clamped === stopIndex) return;
      setDirection(clamped > stopIndex ? 1 : -1);
      setStopIndex(clamped);
      setFocusedStarId(plan.stops[clamped].starId);
    },
    [plan, stopIndex],
  );

  const focusStar = useCallback(
    (starId: string) => {
      if (!starIds.has(starId)) return;
      supersede();
      setPlan(null);
      setStopIndex(0);
      setPendingQuestion(null);
      setError(null);
      setDirection(1);
      setFocusedStarId(starId);
      setStatus("flying");
    },
    [supersede],
  );

  const reset = useCallback(() => {
    supersede();
    setPlan(null);
    setStopIndex(0);
    setPendingQuestion(null);
    setError(null);
    setFocusedStarId(null);
    setStatus("idle");
  }, [supersede]);

  const dismissError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), ERROR_TTL_MS);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => () => inflight.current?.abort(), []);

  const value = useMemo<FlightContextValue>(
    () => ({
      plan,
      stopIndex,
      focusedStarId,
      status,
      pendingQuestion,
      error,
      direction,
      ask,
      askChip,
      next: () => goTo(stopIndex + 1),
      prev: () => goTo(stopIndex - 1),
      goTo,
      focusStar,
      reset,
      dismissError,
      narration,
      beams,
      view,
      answerMode,
      yearRange,
      tour,
      pulses,
      intro,
      setYearRange,
      startTour: () => setTour({ active: true, index: 0 }),
      stopTour: () => setTour({ active: false, index: 0 }),
      finishIntro: () => setIntro("done"),
    }),
    [
      plan,
      stopIndex,
      focusedStarId,
      status,
      pendingQuestion,
      error,
      direction,
      ask,
      askChip,
      goTo,
      focusStar,
      reset,
      dismissError,
      narration,
      beams,
      view,
      answerMode,
      yearRange,
      tour,
      pulses,
      intro,
    ],
  );

  return <FlightContext.Provider value={value}>{children}</FlightContext.Provider>;
}

export function useFlight(): FlightContextValue {
  const value = useContext(FlightContext);
  if (!value) throw new Error("useFlight must be used inside FlightProvider");
  return value;
}
