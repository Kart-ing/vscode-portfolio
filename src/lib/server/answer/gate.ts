// The relevance gate for typed questions (invariant I1 in the owner's one-story
// PRD of 6 Oct 2026). With no model involved, the local keyword router decides
// which record lines may answer a question: at most K = 12 facet ids, in the
// router's order. The model may only pick ids from that set, and the router's
// own answer is drawn from it too, so no path can show a line from outside it.
//
// The gate reads the question's topic tokens (the router's, after its intent
// filtering) against each star's metadata: tags, label, id, stack,
// constellation and kind.
//   - A token that reaches 1 to 3 stars is an anchor, unless it is a word for
//     work in general ("build", "work") or a technology, named in no star's
//     label, that the router's stack intent already handles ("TypeScript").
//     It is named when it is in a star's label ("Intel", "Karts", "Snap") and
//     an attribute otherwise ("nasa", "hf0", "yc", "founder").
//   - When an anchor reaches several stars, the question's other words choose
//     among them: "work with Snap" keeps the accelerator, not the Snap AR prize.
//   - Named anchors win: the candidates are the stars they reach. Without one,
//     the candidates are the stars that carry every attribute anchor, so
//     "a YC founder" needs a single star that is both, and finds none.
//   - When the question relates an anchor to something else ("worked for
//     Intel", "work with Snap"), only the star's lines that mention an anchor
//     are kept, when any do.
//   - Without anchors, the candidates are the router's own answer, and for a
//     question with no stack, LLM or "best" intent, only the stars whose
//     metadata it reaches. A line that merely shares a word is not enough, so
//     "where does he live" reaches nothing.
// Lines that only say where a fact came from ("Devpost tagline") are never
// candidates. It never throws; on any failure the set is empty.

import { MAX_STOPS, type Facet, type FlightStop, type Star, type WorkRecord } from "@/lib/contract";
import { isDeniedQuestion } from "@/lib/server/flight/deny";
import { expandTokens } from "@/lib/server/flight/local-router";
import { normalizeQuestion, tokenize } from "@/lib/server/flight/text";
import { GENERIC_WORDS, rankStars } from "./local";
import { isLeakedPhrasing } from "./protocol";

/** K: the most facet ids one question's candidate set holds. */
export const MAX_CANDIDATES = 12;
/** A topic token that reaches at most this many stars is an anchor. */
export const MAX_ANCHOR_STARS = 3;

export interface Candidates {
  /** At most MAX_CANDIDATES stops in the router's order; empty means no answer. */
  candidates: FlightStop[];
  /** The router's own answer: each candidate star's first line, at most MAX_STOPS. Always inside `candidates`. */
  answer: FlightStop[];
}

const EMPTY: Candidates = { candidates: [], answer: [] };

interface GateIndex {
  stars: Star[];
  /** Metadata tokens per star. */
  meta: Map<string, ReadonlySet<string>>;
  /** Label tokens per star. */
  label: Map<string, ReadonlySet<string>>;
  /** Candidate-eligible facets per star, in record order. */
  lines: Map<string, Facet[]>;
  /** Text tokens per facet. */
  text: Map<string, ReadonlySet<string>>;
}

const indexes = new WeakMap<WorkRecord, GateIndex>();

function buildGateIndex(record: WorkRecord): GateIndex {
  const cached = indexes.get(record);
  if (cached) return cached;
  const meta = new Map<string, ReadonlySet<string>>();
  const label = new Map<string, ReadonlySet<string>>();
  for (const star of record.stars) {
    const tokens = new Set<string>();
    for (const tag of star.tags) for (const t of tokenize(tag)) tokens.add(t);
    for (const t of tokenize(star.label)) tokens.add(t);
    for (const t of tokenize(star.id.replace(/-/g, " "))) tokens.add(t);
    for (const entry of star.stack ?? []) for (const t of tokenize(entry)) tokens.add(t);
    tokens.add(`constellation:${star.constellation}`);
    tokens.add(`kind:${star.kind}`);
    meta.set(star.id, tokens);
    label.set(star.id, new Set(tokenize(star.label)));
  }
  const lines = new Map<string, Facet[]>();
  const text = new Map<string, ReadonlySet<string>>();
  for (const facet of record.facets) {
    if (!meta.has(facet.starId) || isLeakedPhrasing(facet.text)) continue;
    const list = lines.get(facet.starId) ?? [];
    list.push(facet);
    lines.set(facet.starId, list);
    text.set(facet.id, new Set(tokenize(facet.text)));
  }
  const index: GateIndex = {
    stars: record.stars.filter((star) => lines.has(star.id)),
    meta,
    label,
    lines,
    text,
  };
  indexes.set(record, index);
  return index;
}

interface Group {
  token: string;
  /** The token and its synonym pseudo-tags. */
  terms: string[];
  /** Stars whose metadata carries one of the terms. */
  stars: Star[];
}

/** The candidate set and the router's answer for one question. */
export function answerCandidates(question: string, record: WorkRecord): Candidates {
  try {
    return gate(question, record);
  } catch {
    return EMPTY;
  }
}

function gate(question: string, record: WorkRecord): Candidates {
  const normalized = normalizeQuestion(question);
  if (!normalized || isDeniedQuestion(normalized)) return EMPTY;
  const index = buildGateIndex(record);
  const ranking = rankStars(question, record);
  const position = new Map(ranking.ranked.map((entry, i) => [entry.starId, i]));
  const routerLine = new Map(ranking.ranked.map((entry) => [entry.starId, entry.facetId]));

  const carries = (star: Star, terms: readonly string[]) => {
    const own = index.meta.get(star.id);
    return !!own && terms.some((term) => own.has(term));
  };
  const groups: Group[] = [...new Set(ranking.topic)].map((token) => {
    const terms = expandTokens([token]);
    return { token, terms, stars: index.stars.filter((star) => carries(star, terms)) };
  });
  // Words for work in general ("build", "work", "project") never anchor, and
  // neither does a technology that names no star: the router's stack intent
  // already keeps every star whose stack or lines carry it. A word in a
  // star's label is that star's name ("Snap"), even when a stack lists it too.
  const techTokens = new Set(ranking.stackTerms.flatMap((term) => tokenize(term)));
  const isNamed = (g: Group) => g.stars.some((star) => index.label.get(star.id)?.has(g.token));
  const anchors = groups.filter(
    (g) =>
      !GENERIC_WORDS.has(g.token) &&
      (isNamed(g) || !techTokens.has(g.token)) &&
      g.stars.length >= 1 &&
      g.stars.length <= MAX_ANCHOR_STARS,
  );

  /** An anchor's stars, narrowed to those that carry the most of the question's other words. */
  const narrow = (anchor: Group): Star[] => {
    if (anchor.stars.length < 2) return anchor.stars;
    const others = groups.filter((g) => g !== anchor);
    const reach = (star: Star) => others.filter((g) => carries(star, g.terms)).length;
    const top = Math.max(...anchor.stars.map(reach));
    return anchor.stars.filter((star) => reach(star) === top);
  };

  let starIds: string[];
  let lineTerms: string[] = [];
  if (anchors.length > 0) {
    const named = anchors.filter(isNamed);
    if (named.length > 0) {
      starIds = [...new Set(named.flatMap((g) => narrow(g).map((star) => star.id)))];
    } else {
      const sets = anchors.map((g) => new Set(narrow(g).map((star) => star.id)));
      starIds = [...sets[0]].filter((id) => sets.every((set) => set.has(id)));
    }
    // "Worked for Intel": the question relates the anchor to another word that
    // reaches the record, so only lines that mention an anchor answer it.
    // "Compare Karts and Multiverse" relates nothing and keeps every line.
    const relates = groups.some((g) => !anchors.includes(g) && g.stars.length > 0);
    if (relates) lineTerms = anchors.flatMap((g) => g.terms);
  } else if (ranking.intent !== null) {
    starIds = ranking.answer.map((entry) => entry.starId);
  } else {
    const reached = new Set(groups.flatMap((g) => g.stars.map((star) => star.id)));
    starIds = ranking.answer.map((entry) => entry.starId).filter((id) => reached.has(id));
  }
  starIds.sort((a, b) => (position.get(a) ?? Infinity) - (position.get(b) ?? Infinity));

  /** A star's candidate lines: the router's chosen line first, then record order. */
  const linesOf = (starId: string): Facet[] => {
    const all = index.lines.get(starId) ?? [];
    const hits = lineTerms.length > 0 ? all.filter((f) => lineTerms.some((t) => index.text.get(f.id)?.has(t))) : [];
    const kept = hits.length > 0 ? hits : all;
    const first = routerLine.get(starId);
    return [...kept.filter((f) => f.id === first), ...kept.filter((f) => f.id !== first)];
  };

  const perStar = starIds.map(linesOf).filter((list) => list.length > 0);
  const candidates: FlightStop[] = [];
  for (let round = 0; candidates.length < MAX_CANDIDATES; round += 1) {
    let added = false;
    for (const list of perStar) {
      const facet = list[round];
      if (!facet) continue;
      candidates.push({ starId: facet.starId, facetId: facet.id });
      added = true;
      if (candidates.length >= MAX_CANDIDATES) break;
    }
    if (!added) break;
  }
  const answer = perStar
    .slice(0, MAX_STOPS)
    .map((list) => ({ starId: list[0].starId, facetId: list[0].id }))
    .filter((stop) => candidates.some((c) => c.facetId === stop.facetId));
  return { candidates, answer };
}
