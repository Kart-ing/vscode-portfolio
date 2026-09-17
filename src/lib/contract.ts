// Shared contract for kartikey.fyi (V2, extended for V3). Every agent builds against these types.
// Only the orchestrator changes this file.

export type ConstellationId =
  | "building"
  | "agent-tools"
  | "research"
  | "hackathons"
  | "work"
  | "leadership"
  | "education"
  | "more-projects";

export interface SourceLink {
  label: string;
  /** Absolute https URL. */
  url: string;
}

export type StarKind =
  | "company"
  | "project"
  | "paper"
  | "patent"
  | "award"
  | "role"
  | "education"
  | "community";

export interface Star extends StarMeta {
  /** Unique kebab-case id, for example "karts". */
  id: string;
  label: string;
  constellation: ConstellationId;
  kind: StarKind;
  /** Human-readable period, for example "2026" or "Aug 2024 – Dec 2025". */
  period?: string;
  /** One sentence from the verified record. */
  summary: string;
  /** Lowercase aliases the local router matches against. */
  tags: string[];
  /** Evidence first. */
  links: SourceLink[];
  /** Visual prominence; 3 is brightest. */
  weight: 1 | 2 | 3;
}

export interface Facet {
  /** Unique id in the form "<starId>.<slug>". */
  id: string;
  starId: string;
  /** One verified line, at most 200 characters. */
  text: string;
  /** Evidence for this specific line, when it differs from the star's links. */
  source?: SourceLink;
}

export interface WorkRecord {
  owner: {
    name: string;
    role: string;
    tagline: string;
    links: SourceLink[];
  };
  constellations: { id: ConstellationId; label: string }[];
  stars: Star[];
  facets: Facet[];
}

export interface FlightStop {
  starId: string;
  facetId: string;
}

/** How a plan was produced. */
export type FlightMode = "chip" | "cache" | "model" | "local" | "none";

export interface FlightPlan {
  question: string;
  /** Between 1 and MAX_STOPS stops; empty only when mode is "none". */
  stops: FlightStop[];
  mode: FlightMode;
}

/** A preset question whose plan is fixed and never calls the model. */
export interface Chip {
  label: string;
  question: string;
  stops: FlightStop[];
  /** V3: curated narration, so a chip never calls the model. */
  sentences?: AnswerSentence[];
  /** V3: an optional staged 3D view. */
  view?: GeneratedView;
}

/** Body of POST /api/flight. The response body is a FlightPlan. */
export interface FlightRequest {
  question: string;
}

export const MAX_QUESTION_CHARS = 200;
export const MAX_STOPS = 4;

// ------------------------------------------------------------------ V3

export interface MediaItem {
  kind: "image" | "video";
  /** Path under /media, for example "/media/eyesnap.jpg". */
  src: string;
  alt: string;
  width?: number;
  height?: number;
  credit?: SourceLink;
}

/** Optional star metadata for the timeline, stack views, richer cards and pulses. */
export interface StarMeta {
  /** First month of the work, "YYYY-MM". Drives the timeline and the intro order. */
  start?: string;
  /** Technologies as display names, for badges and stack views. */
  stack?: string[];
  /** Public GitHub repo "owner/name", for live stats and pulses. */
  repo?: string;
  /** Owner's own project images, stored under /public/media. */
  media?: MediaItem[];
}

/** A 3D arrangement the answer can stage. */
export type GeneratedView =
  | { kind: "timeline"; starIds: string[] }
  | { kind: "compare"; starIds: string[] }
  | { kind: "stack"; starIds: string[] }
  | { kind: "constellation"; constellation: ConstellationId };

export type AnswerMode = "advocate" | "chip" | "cache" | "model" | "local" | "none";

/** One validated sentence. Every sentence cites at least one facet, except a scripted "Yes." */
export interface AnswerSentence {
  text: string;
  citations: FlightStop[];
}

/** POST /api/answer streams NDJSON: one AnswerEvent per line, always ending with "done". */
export type AnswerEvent =
  | { type: "beams"; starIds: string[] }
  | { type: "view"; view: GeneratedView }
  | { type: "say"; sentence: AnswerSentence }
  | { type: "done"; mode: AnswerMode }
  | { type: "error"; message: string };

export interface AnswerRequest {
  question: string;
}

/** A curated, model-free answer: the advocate answer and the highlights. */
export interface ScriptedAnswer {
  question: string;
  view?: GeneratedView;
  sentences: AnswerSentence[];
}

/** One stop of the guided tour. */
export interface TourStep {
  sentence: AnswerSentence;
  /** How long the camera holds on the first citation, in milliseconds. */
  holdMs: number;
}

/** GET /api/pulse returns RepoPulse[] for stars that have a repo. */
export interface RepoPulse {
  starId: string;
  repo: string;
  stars: number;
  lastPushAt: string | null;
  pushesLast30d: number;
}

export const MAX_SENTENCES = 4;
export const TIMELINE_START_YEAR = 2020;
export const TIMELINE_END_YEAR = 2026;
