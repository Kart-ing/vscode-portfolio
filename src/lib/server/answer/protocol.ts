// The model's output protocol and the truth rules, applied line by line:
//
//   VIEW <timeline|compare|stack|constellation> <ids...>   (optional, at most one)
//   SAY <one sentence> [facet.id] [facet.id]
//   END
//
// A SAY line survives only with at least one citation that exists, only when
// every number in it appears in a cited facet's text, only when it names what
// the work is rather than where the fact came from, and, when the question
// names a technology, only when a cited star or facet carries that
// technology. A VIEW survives only with a known kind and enough valid ids.
// Everything else is dropped before it reaches the client. Nothing here throws.

import {
  MAX_SENTENCES,
  type AnswerEvent,
  type AnswerSentence,
  type ConstellationId,
  type Facet,
  type FlightStop,
  type GeneratedView,
  type WorkRecord,
} from "@/lib/contract";
import { normalizeQuestion } from "@/lib/server/flight/text";
import { stackVocabulary, textHasTerm, type StackVocabulary } from "./stack-terms";

export const MAX_SENTENCE_CHARS = 280;
/** Largest star list a timeline or stack view carries. */
export const MAX_VIEW_STARS = 12;
export const MAX_COMPARE_STARS = 3;

export interface TruthIndex {
  facets: ReadonlyMap<string, Facet>;
  /** Digit-normalized number tokens found in each facet's text. */
  facetNumbers: ReadonlyMap<string, ReadonlySet<string>>;
  /** Each facet's text normalized like a question, for relevance checks. */
  facetText: ReadonlyMap<string, string>;
  /** Facet ids per star, in record order. */
  facetsByStar: ReadonlyMap<string, readonly string[]>;
  stars: ReadonlySet<string>;
  constellations: ReadonlySet<string>;
  vocabulary: StackVocabulary;
}

const indexes = new WeakMap<WorkRecord, TruthIndex>();

export function buildTruthIndex(record: WorkRecord): TruthIndex {
  const cached = indexes.get(record);
  if (cached) return cached;
  const stars = new Set(record.stars.map((star) => star.id));
  const facets = new Map<string, Facet>();
  const facetNumbers = new Map<string, Set<string>>();
  const facetText = new Map<string, string>();
  const facetsByStar = new Map<string, string[]>();
  for (const facet of record.facets) {
    if (!stars.has(facet.starId)) continue;
    facets.set(facet.id, facet);
    facetNumbers.set(facet.id, new Set(numberTokens(facet.text)));
    facetText.set(facet.id, normalizeQuestion(facet.text));
    const list = facetsByStar.get(facet.starId) ?? [];
    list.push(facet.id);
    facetsByStar.set(facet.starId, list);
  }
  const index: TruthIndex = {
    facets,
    facetNumbers,
    facetText,
    facetsByStar,
    stars,
    constellations: new Set(record.constellations.map((c) => c.id)),
    vocabulary: stackVocabulary(record),
  };
  indexes.set(record, index);
  return index;
}

/** Digit runs with inner separators: "1,482" and "3.5" stay whole, "2026." loses its period. */
const NUMBER = /\d+(?:[.,]\d+)*/g;

/** Every number in `text`, digit-normalized: thousands commas removed, units and signs dropped. */
export function numberTokens(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(NUMBER)) out.push(match[0].replace(/,/g, ""));
  return out;
}

/** Phrasing that reveals where a fact came from instead of what the work is. */
const LEAKED = /\b(?:tagline|taglines|devpost)\b/i;

export function isLeakedPhrasing(text: string): boolean {
  return LEAKED.test(text);
}

export type ProtocolLine =
  | { kind: "say"; body: string }
  | { kind: "view"; body: string }
  | { kind: "end" }
  | { kind: "other"; body: string };

/** Optional list marker or bold, then the keyword, an optional colon, then the body. */
const KEYWORD = /^\s*(?:[-*>•]+\s*|\d+[.)]\s*)?(?:\*\*|`)?(SAY|VIEW|END)(?:\*\*|`)?(?=[\s:.!]|$)\s*[:.!]?\s*(.*?)\s*$/i;
const CITATION = /\[([^[\]]*)\]/g;

/**
 * Only a line that starts with SAY, VIEW or END is protocol. Everything else,
 * including a visible "thinking" preamble that happens to mention ids in
 * brackets, is ignored.
 */
export function parseProtocolLine(line: string): ProtocolLine {
  const match = KEYWORD.exec(line);
  if (!match) return { kind: "other", body: line };
  const keyword = match[1].toUpperCase();
  const body = match[2] ?? "";
  if (keyword === "END") return { kind: "end" };
  if (keyword === "VIEW") return { kind: "view", body };
  return { kind: "say", body };
}

function stripEdgePunctuation(token: string): string {
  return token.replace(/^[([{"'`«]+/, "").replace(/[)\]}"'`»,;:.!?]+$/, "");
}

/**
 * Splits a SAY body into display text and citations. Ids in square brackets
 * count, and so does a bare token that exactly matches a facet id, since a
 * facet id never reads as an English word. Unknown ids are dropped.
 */
export function extractCitations(
  body: string,
  index: TruthIndex,
): { text: string; citations: FlightStop[] } {
  const ids: string[] = [];
  const withoutBrackets = body.replace(CITATION, (_all, inner: string) => {
    for (const part of inner.split(/[\s,;]+/)) if (part) ids.push(part);
    return " ";
  });
  const words: string[] = [];
  for (const word of withoutBrackets.split(/\s+/)) {
    if (!word) continue;
    const bare = stripEdgePunctuation(word);
    if (bare.includes(".") && index.facets.has(bare)) {
      ids.push(bare);
      continue;
    }
    words.push(word);
  }
  const citations: FlightStop[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = stripEdgePunctuation(raw);
    const facet = index.facets.get(id);
    if (!facet || seen.has(id)) continue;
    seen.add(id);
    citations.push({ starId: facet.starId, facetId: facet.id });
  }
  const text = words
    .join(" ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    // A model that writes "…reliability, [id]" leaves a comma where the sentence ends.
    .replace(/[,;:]+$/, ".");
  return { text, citations };
}

/** Cuts at a word boundary so the result, ellipsis included, fits MAX_SENTENCE_CHARS. */
export function clipSentence(text: string): string {
  if (text.length <= MAX_SENTENCE_CHARS) return text;
  const cut = text.slice(0, MAX_SENTENCE_CHARS - 1);
  const space = cut.lastIndexOf(" ");
  const head = space > MAX_SENTENCE_CHARS / 2 ? cut.slice(0, space) : cut;
  return `${head.replace(/[\s,;:]+$/, "")}…`;
}

export interface SayOptions {
  /**
   * Stack terms the question names (see stackTermsIn). When present, a
   * sentence survives only if a cited star's stack or a cited facet's text
   * carries at least one of them.
   */
  stackTerms?: readonly string[];
}

/** True when no terms apply, or a cited star or facet carries one of them. */
export function isRelevantCitation(
  citations: readonly FlightStop[],
  stackTerms: readonly string[] | undefined,
  index: TruthIndex,
): boolean {
  if (!stackTerms || stackTerms.length === 0) return true;
  return stackTerms.some((term) =>
    citations.some(
      (c) =>
        index.vocabulary.byStar.get(c.starId)?.has(term) ||
        textHasTerm(index.facetText.get(c.facetId) ?? "", term),
    ),
  );
}

/** True when the star's stack, or any facet of the star, carries one of the terms. */
export function isRelevantStar(starId: string, stackTerms: readonly string[], index: TruthIndex): boolean {
  return stackTerms.some(
    (term) =>
      index.vocabulary.byStar.get(starId)?.has(term) ||
      (index.facetsByStar.get(starId) ?? []).some((facetId) => textHasTerm(index.facetText.get(facetId) ?? "", term)),
  );
}

/**
 * A view pinned to the question's technology: star lists keep only relevant
 * stars and need two of them; a constellation view passes unchanged.
 */
export function relevantView(view: GeneratedView, stackTerms: readonly string[] | undefined, index: TruthIndex): GeneratedView | null {
  if (!stackTerms || stackTerms.length === 0 || view.kind === "constellation") return view;
  const starIds = view.starIds.filter((starId) => isRelevantStar(starId, stackTerms, index));
  if (starIds.length < 2) return null;
  return { kind: view.kind, starIds };
}

/** Truth rules for one SAY body; null means the sentence is dropped. */
export function validateSay(body: string, index: TruthIndex, options: SayOptions = {}): AnswerSentence | null {
  const { text, citations } = extractCitations(body, index);
  if (citations.length === 0) return null;
  if (!text) return null;
  const allowed = new Set<string>();
  for (const citation of citations) {
    for (const token of index.facetNumbers.get(citation.facetId) ?? []) allowed.add(token);
  }
  for (const token of numberTokens(text)) {
    if (!allowed.has(token)) return null;
  }
  if (isLeakedPhrasing(text)) return null;
  if (!isRelevantCitation(citations, options.stackTerms, index)) return null;
  return { text: clipSentence(text), citations };
}

/** Resolves a token to a star id: a star id as written, or the star of a facet id. */
function resolveStar(token: string, index: TruthIndex): string | undefined {
  const id = stripEdgePunctuation(token).toLowerCase();
  if (!id) return undefined;
  if (index.stars.has(id)) return id;
  return index.facets.get(id)?.starId;
}

/** A VIEW body: known kind plus enough valid ids; null means the view is dropped. */
export function validateView(body: string, index: TruthIndex): GeneratedView | null {
  const parts = body.trim().split(/[\s,;]+/).filter(Boolean);
  if (parts.length === 0) return null;
  const kind = stripEdgePunctuation(parts[0]).toLowerCase();
  const rest = parts.slice(1);
  if (kind === "constellation") {
    for (const token of rest) {
      const id = stripEdgePunctuation(token).toLowerCase();
      if (index.constellations.has(id)) return { kind, constellation: id as ConstellationId };
    }
    return null;
  }
  if (kind !== "timeline" && kind !== "compare" && kind !== "stack") return null;
  const starIds: string[] = [];
  for (const token of rest) {
    const starId = resolveStar(token, index);
    if (starId && !starIds.includes(starId)) starIds.push(starId);
  }
  if (starIds.length < 2) return null;
  if (kind === "compare") return { kind, starIds: starIds.slice(0, MAX_COMPARE_STARS) };
  return { kind, starIds: starIds.slice(0, MAX_VIEW_STARS) };
}

/**
 * Feeds protocol lines in order and returns the events each one earns. Stops
 * after END or MAX_SENTENCES valid sentences; at most one view is kept.
 */
export class ProtocolValidator {
  private viewSeen = false;
  private sentences = 0;
  private finished = false;

  constructor(
    private readonly index: TruthIndex,
    private readonly options: SayOptions = {},
  ) {}

  /** True once END arrived or the sentence cap was reached. */
  get done(): boolean {
    return this.finished;
  }

  get sentenceCount(): number {
    return this.sentences;
  }

  accept(line: string): AnswerEvent[] {
    if (this.finished) return [];
    try {
      const parsed = parseProtocolLine(line);
      switch (parsed.kind) {
        case "end":
          this.finished = true;
          return [];
        case "view": {
          if (this.viewSeen) return [];
          const parsedView = validateView(parsed.body, this.index);
          const view = parsedView && relevantView(parsedView, this.options.stackTerms, this.index);
          if (!view) return [];
          this.viewSeen = true;
          return [{ type: "view", view }];
        }
        case "say": {
          const sentence = validateSay(parsed.body, this.index, this.options);
          if (!sentence) return [];
          this.sentences += 1;
          if (this.sentences >= MAX_SENTENCES) this.finished = true;
          return [{ type: "say", sentence }];
        }
        default:
          return [];
      }
    } catch {
      return [];
    }
  }
}
