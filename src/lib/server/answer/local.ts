// The V3 local router: V2's IDF scoring plus three intents.
//
//   a named technology       -> stars whose stack or facet text carries it, and
//   stack/tech/language/tool    otherwise the stars that declare a `stack`
//   llm/ai/ml/agents/models  -> the research and agent-tools constellations,
//                               plus stars tagged with those words (AdLayer)
//   best/top/flagship/proud  -> the strongest facets of weight 2-3 stars
//
// It produces the narrated fallback (1-4 facets) and the thinking beams
// (3-6 star ids). A facet whose text only says where a fact came from
// ("Devpost tagline") yields to a sibling. It never throws and never returns
// nothing for a question with a keyword hit; the caller uses the highlights
// when it comes back empty.

import { MAX_STOPS, type Facet, type FlightStop, type Star, type WorkRecord } from "@/lib/contract";
import { expandTokens, scoreTerms } from "@/lib/server/flight/local-router";
import { normalizeQuestion, tokenize } from "@/lib/server/flight/text";
import { isLeakedPhrasing } from "./protocol";
import { stackTermsIn, stackVocabulary, textHasTerm } from "./stack-terms";

export const MIN_BEAMS = 3;
export const MAX_BEAMS = 6;
/** Same floors as V2's router. */
const MIN_SCORE = 1.5;
const MIN_RELATIVE = 0.35;

export type Intent = "best" | "stack" | "llm" | null;

/** Stemmed tokens (see tokenize) that ask for the strongest work. */
const BEST_WORDS = new Set([
  "best", "top", "flagship", "proud", "proudest", "biggest", "greatest", "strongest",
  "impressive", "highlight", "standout", "notable", "signature", "favorite", "favourite",
  "crowning", "finest", "coolest", "peak", "headline", "star", "showcase",
]);
/** Words that name work in general; alone with a BEST word they carry no topic. */
const GENERIC_WORDS = new Set([
  "work", "project", "thing", "stuff", "achievement", "accomplishment", "creation",
  "build", "built", "done", "do", "did", "piece", "item", "example", "result", "moment",
  "effort", "far", "date", "ship", "shipped", "career", "portfolio", "record", "list",
]);
const STACK_WORDS = new Set([
  "stack", "tech", "technology", "language", "framework", "library", "programming",
  "code", "cod", "tool", "skill", "written", "toolchain", "techstack", "technical",
]);
const LLM_WORDS = new Set([
  "llm", "ai", "ml", "agent", "agentic", "model", "gpt", "transformer", "neural",
  "genai", "chatbot", "nlp", "lora", "finetune", "finetuning", "inference", "embedding",
  "rag", "prompt", "compression",
]);
const LLM_CONSTELLATIONS = new Set(["research", "agent-tools"]);

interface LocalIndex {
  stars: Star[];
  order: Map<string, number>;
  facetsByStar: Map<string, Facet[]>;
  /** Each facet's text normalized like a question. */
  facetText: Map<string, string>;
  /** Stars that declare a stack. */
  hasStack: Set<string>;
  /** Stars whose tags or label carry an LLM word. */
  llmTagged: Set<string>;
}

const indexes = new WeakMap<WorkRecord, LocalIndex>();

function buildLocalIndex(record: WorkRecord): LocalIndex {
  const cached = indexes.get(record);
  if (cached) return cached;
  const order = new Map<string, number>();
  const facetsByStar = new Map<string, Facet[]>();
  const facetText = new Map<string, string>();
  const hasStack = new Set<string>();
  const llmTagged = new Set<string>();
  record.stars.forEach((star, i) => {
    order.set(star.id, i);
    if (star.stack && star.stack.length > 0) hasStack.add(star.id);
    const tagTokens = [...star.tags, star.label].flatMap((t) => tokenize(t));
    if (tagTokens.some((t) => LLM_WORDS.has(t))) llmTagged.add(star.id);
  });
  for (const facet of record.facets) {
    if (!order.has(facet.starId)) continue;
    const list = facetsByStar.get(facet.starId) ?? [];
    list.push(facet);
    facetsByStar.set(facet.starId, list);
    facetText.set(facet.id, normalizeQuestion(facet.text));
  }
  const index: LocalIndex = {
    stars: record.stars.filter((star) => facetsByStar.has(star.id)),
    order,
    facetsByStar,
    facetText,
    hasStack,
    llmTagged,
  };
  indexes.set(record, index);
  return index;
}

export interface RankedStar {
  starId: string;
  facetId: string;
  score: number;
  /** True when the question's words reached this star, rather than a bright-star fallback. */
  hit: boolean;
}

export interface LocalRanking {
  intent: Intent;
  /** Every star, most relevant first. */
  ranked: RankedStar[];
  /** The entries the narrated answer draws from, before the MAX_STOPS cap. */
  answer: RankedStar[];
}

const byWeightThenOrder =
  (index: LocalIndex) =>
  (a: { star: Star }, b: { star: Star }): number =>
    b.star.weight - a.star.weight || index.order.get(a.star.id)! - index.order.get(b.star.id)!;

interface Entry {
  star: Star;
  facet: Facet;
  score: number;
  stackHits: number;
}

export function rankStars(question: string, record: WorkRecord): LocalRanking {
  try {
    return rankUnsafe(question, record);
  } catch {
    return { intent: null, ranked: [], answer: [] };
  }
}

function rankUnsafe(question: string, record: WorkRecord): LocalRanking {
  const index = buildLocalIndex(record);
  const vocabulary = stackVocabulary(record);
  const tokens = tokenize(question);
  const has = (set: ReadonlySet<string>) => tokens.some((t) => set.has(t));
  const terms = stackTermsIn(normalizeQuestion(question), vocabulary);
  const facetHasTerm = (facet: Facet) => terms.some((term) => textHasTerm(index.facetText.get(facet.id) ?? "", term));

  // Per star: how many named technologies its stack declares, and whether a
  // facet of its own mentions one.
  const stackHits = new Map<string, number>();
  const termFacet = new Map<string, Facet>();
  if (terms.length > 0) {
    for (const star of index.stars) {
      const own = vocabulary.byStar.get(star.id);
      const n = terms.filter((t) => own?.has(t)).length;
      if (n > 0) stackHits.set(star.id, n);
      const facets = index.facetsByStar.get(star.id) ?? [];
      const facet = facets.find((f) => !isLeakedPhrasing(f.text) && facetHasTerm(f)) ?? facets.find(facetHasTerm);
      if (facet) termFacet.set(star.id, facet);
    }
  }

  const languageModel = tokens.includes("language") && tokens.includes("model");
  const wantsLlm =
    has(LLM_WORDS) ||
    tokens.includes("artificial") ||
    (tokens.includes("machine") && tokens.includes("learn")) ||
    (tokens.includes("deep") && tokens.includes("learn"));
  // A named technology ("python") always means the stack; a bare stack word
  // ("tools") yields to an LLM question ("AI agent tools").
  const wantsStack =
    terms.length > 0 || (index.hasStack.size > 0 && has(STACK_WORDS) && !languageModel && !wantsLlm);
  const wantsBest = has(BEST_WORDS);

  let intent: Intent = null;
  let candidates: Star[] = index.stars;
  let scoringTerms: string[];
  if (wantsStack) {
    intent = "stack";
    candidates =
      terms.length > 0
        ? index.stars.filter((star) => stackHits.has(star.id) || termFacet.has(star.id))
        : index.stars.filter((star) => index.hasStack.has(star.id));
    scoringTerms = expandTokens(tokens.filter((t) => !STACK_WORDS.has(t)));
  } else if (wantsLlm) {
    intent = "llm";
    candidates = index.stars.filter(
      (star) => LLM_CONSTELLATIONS.has(star.constellation) || index.llmTagged.has(star.id),
    );
    if (candidates.length === 0) candidates = index.stars;
    scoringTerms = expandTokens(tokens);
  } else if (wantsBest) {
    intent = "best";
    scoringTerms = expandTokens(tokens.filter((t) => !BEST_WORDS.has(t) && !GENERIC_WORDS.has(t)));
  } else {
    scoringTerms = expandTokens(tokens);
  }

  const scores = new Map(scoreTerms(scoringTerms, record).map((s) => [s.starId, s]));

  /** The facet of `star` that names the most of its own stack entries. */
  const stackFacet = (star: Star): Facet | undefined => {
    const facets = index.facetsByStar.get(star.id) ?? [];
    const own = vocabulary.byStar.get(star.id);
    if (!own) return undefined;
    let best: Facet | undefined;
    let bestCount = 0;
    for (const facet of facets) {
      const text = index.facetText.get(facet.id) ?? "";
      const count = [...own].filter((term) => textHasTerm(text, term)).length;
      if (count > bestCount) {
        best = facet;
        bestCount = count;
      }
    }
    return best;
  };

  /** Candidates in order of preference; the first that names the work itself wins. */
  const chooseFacet = (star: Star): Facet | undefined => {
    const facets = index.facetsByStar.get(star.id) ?? [];
    const scored = scores.get(star.id);
    const preferred = [
      termFacet.get(star.id),
      scored ? facets.find((f) => f.id === scored.facetId) : undefined,
      intent === "stack" ? stackFacet(star) : undefined,
      facets[0],
    ].filter((f): f is Facet => f !== undefined);
    return preferred.find((f) => !isLeakedPhrasing(f.text)) ?? facets.find((f) => !isLeakedPhrasing(f.text)) ?? preferred[0];
  };

  const entries: Entry[] = [];
  for (const star of candidates) {
    const facet = chooseFacet(star);
    if (!facet) continue;
    entries.push({ star, facet, score: scores.get(star.id)?.score ?? 0, stackHits: stackHits.get(star.id) ?? 0 });
  }
  const bright = byWeightThenOrder(index);
  const order = (a: Entry, b: Entry) => index.order.get(a.star.id)! - index.order.get(b.star.id)!;
  const rest = (chosen: Entry[]) =>
    index.stars
      .filter((star) => !chosen.some((e) => e.star.id === star.id))
      .map((star) => ({ star, facet: chooseFacet(star), score: 0, stackHits: 0 }))
      .filter((e): e is Entry => e.facet !== undefined)
      .sort(bright);

  let answer: Entry[];
  let ranked: Entry[];
  if (intent === "stack" && terms.length > 0) {
    // Only stars that carry the named technology, in their stack or a facet.
    answer = [...entries].sort((a, b) => b.stackHits - a.stackHits || b.score - a.score || bright(a, b));
    ranked = [...answer, ...rest(answer)];
  } else if (intent === "stack") {
    const hits = entries.filter((e) => e.score >= MIN_SCORE).sort((a, b) => b.score - a.score || bright(a, b));
    const others = entries.filter((e) => !hits.includes(e)).sort(bright);
    answer = hits.length > 0 ? hits : others;
    ranked = [...hits, ...others, ...rest(entries)];
  } else if (intent === "llm") {
    ranked = [...entries].sort((a, b) => b.score - a.score || bright(a, b));
    answer = ranked;
    ranked = [...ranked, ...rest(ranked)];
  } else if (intent === "best") {
    const hits = entries.filter((e) => e.score >= MIN_SCORE);
    const strong = hits.filter((e) => e.star.weight >= 2);
    if (hits.length > 0) {
      const preferred = (strong.length > 0 ? strong : hits).sort(
        (a, b) => b.star.weight - a.star.weight || b.score - a.score || order(a, b),
      );
      const others = hits.filter((e) => !preferred.includes(e)).sort((a, b) => b.score - a.score || order(a, b));
      answer = [...preferred, ...others];
    } else {
      const brightest = entries.filter((e) => e.star.weight >= 2).sort(bright);
      answer = brightest.length > 0 ? brightest : [...entries].sort(bright);
    }
    ranked = [...answer, ...entries.filter((e) => !answer.includes(e)).sort(bright)];
  } else {
    const hits = entries.filter((e) => e.score > 0).sort((a, b) => b.score - a.score || order(a, b));
    const top = hits[0]?.score ?? 0;
    answer = hits.filter((e) => e.score >= top * MIN_RELATIVE);
    // Only faint hits: keep the answer short rather than pad it with noise.
    if (top < MIN_SCORE) answer = answer.slice(0, 2);
    ranked = [...hits, ...entries.filter((e) => e.score <= 0).sort(bright)];
  }

  const hitIds = new Set(answer.map((e) => e.star.id));
  const toRanked = (e: Entry): RankedStar => ({
    starId: e.star.id,
    facetId: e.facet.id,
    score: e.score,
    hit: hitIds.has(e.star.id),
  });
  return { intent, ranked: ranked.map(toRanked), answer: answer.map(toRanked) };
}

/** 1-4 facets for the narrated fallback, one per star; [] when nothing matched. */
export function localAnswerStops(question: string, record: WorkRecord): FlightStop[] {
  return rankStars(question, record)
    .answer.slice(0, MAX_STOPS)
    .map(({ starId, facetId }) => ({ starId, facetId }));
}

/** 3-6 candidate star ids for the thinking beams, brightest stars padding a thin match. */
export function beamsFor(question: string, record: WorkRecord): string[] {
  const { ranked, answer } = rankStars(question, record);
  const count = Math.min(MAX_BEAMS, Math.max(MIN_BEAMS, answer.length));
  return ranked.slice(0, count).map((r) => r.starId);
}
