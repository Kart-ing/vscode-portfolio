// Shared contract for kartikey.fyi V2. Every agent builds against these types.
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

export interface Star {
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
}

/** Body of POST /api/flight. The response body is a FlightPlan. */
export interface FlightRequest {
  question: string;
}

export const MAX_QUESTION_CHARS = 200;
export const MAX_STOPS = 4;
