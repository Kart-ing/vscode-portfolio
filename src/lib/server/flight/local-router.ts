// Deterministic keyword router. Scores every facet against the question's
// tokens: star tags and label count triple, facet text counts once, and each
// token is weighted by its inverse document frequency across facets. A small
// synonym map turns question words into pseudo-tags for constellations and
// star kinds. It runs in well under a millisecond and never throws.

import { MAX_STOPS, type Facet, type FlightStop, type Star, type WorkRecord } from "@/lib/contract";
import { isDeniedQuestion } from "./deny";
import { normalizeQuestion, tokenize } from "./text";

const TAG_WEIGHT = 3;
const LABEL_WEIGHT = 3;
const TEXT_WEIGHT = 1;
/** Absolute floor: roughly one text hit on a rare term, or any tag hit. */
const MIN_SCORE = 1.5;
/** Relative floor: drop stops far weaker than the best one. */
const MIN_RELATIVE = 0.35;

const WORK = ["constellation:work", "kind:role"];
const AWARD = ["constellation:hackathons", "kind:award"];
const RESEARCH = ["constellation:research"];
const PAPER = ["constellation:research", "kind:paper"];
const PATENT = ["constellation:research", "kind:patent"];
const EDU = ["constellation:education", "kind:education"];
const AGENT = ["constellation:agent-tools"];
const LEAD = ["constellation:leadership", "kind:community"];
const COMPANY = ["kind:company", "constellation:building", "kart"];

/** Question stems mapped to tags or pseudo-tags (`constellation:<id>`, `kind:<kind>`). */
const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  startup: COMPANY, company: COMPANY, founder: COMPANY, found: COMPANY, venture: COMPANY,
  job: WORK, work: WORK, career: WORK, experience: WORK, intern: WORK, internship: WORK,
  employ: WORK, employer: WORK, employment: WORK, professional: WORK,
  won: AWARD, win: AWARD, winn: AWARD, winner: AWARD, prize: AWARD, award: AWARD,
  hackathon: AWARD, competition: AWARD, contest: AWARD, trophy: AWARD, medal: AWARD,
  paper: PAPER, publication: PAPER, publish: RESEARCH, research: RESEARCH, researcher: RESEARCH,
  journal: RESEARCH, conference: RESEARCH, arxiv: RESEARCH, doi: RESEARCH, scientific: RESEARCH,
  patent: PATENT, invention: PATENT, inventor: PATENT,
  school: EDU, degree: EDU, college: EDU, university: EDU, study: EDU, studi: EDU, major: EDU,
  gpa: EDU, graduat: EDU, graduate: EDU, student: EDU, undergrad: EDU, bachelor: EDU,
  master: EDU, phd: EDU, education: EDU, course: EDU,
  agent: AGENT, tool: AGENT, harness: AGENT, mcp: AGENT, sandbox: AGENT, automation: AGENT, llm: AGENT,
  lead: LEAD, led: LEAD, leader: LEAD, leadership: LEAD, community: LEAD, club: LEAD,
  organiz: LEAD, organizer: LEAD, mentor: LEAD, volunteer: LEAD, president: LEAD,
  chapter: LEAD, society: LEAD,
};

interface IndexedFacet {
  facet: Facet;
  star: Star;
  order: number;
  tag: ReadonlySet<string>;
  label: ReadonlySet<string>;
  text: ReadonlySet<string>;
}

interface RouterIndex {
  facets: IndexedFacet[];
  idf: Map<string, number>;
}

const indexes = new WeakMap<WorkRecord, RouterIndex>();

function starTagTokens(star: Star): Set<string> {
  const tokens = new Set<string>();
  for (const tag of star.tags) for (const t of tokenize(tag)) tokens.add(t);
  for (const t of tokenize(star.id.replace(/-/g, " "))) tokens.add(t);
  tokens.add(`constellation:${star.constellation}`);
  tokens.add(`kind:${star.kind}`);
  return tokens;
}

export function buildRouterIndex(record: WorkRecord): RouterIndex {
  const cached = indexes.get(record);
  if (cached) return cached;

  const stars = new Map(record.stars.map((star) => [star.id, star]));
  const tagCache = new Map<string, Set<string>>();
  const labelCache = new Map<string, Set<string>>();
  const facets: IndexedFacet[] = [];
  record.facets.forEach((facet, order) => {
    const star = stars.get(facet.starId);
    if (!star) return;
    let tag = tagCache.get(star.id);
    if (!tag) {
      tag = starTagTokens(star);
      tagCache.set(star.id, tag);
    }
    let label = labelCache.get(star.id);
    if (!label) {
      label = new Set(tokenize(star.label));
      labelCache.set(star.id, label);
    }
    // The star's own name inside a line adds nothing beyond the label match and
    // would otherwise favour whichever facet happens to repeat it.
    const text = new Set(tokenize(facet.text).filter((t) => !label.has(t)));
    facets.push({ facet, star, order, tag, label, text });
  });

  const df = new Map<string, number>();
  for (const entry of facets) {
    const terms = new Set<string>([...entry.tag, ...entry.label, ...entry.text]);
    for (const term of terms) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const total = facets.length;
  const idf = new Map<string, number>();
  for (const [term, count] of df) idf.set(term, Math.log(1 + total / (1 + count)));

  const index = { facets, idf };
  indexes.set(record, index);
  return index;
}

/** Question tokens plus synonym expansions, deduplicated, in order. */
export function expandQuestion(question: string): string[] {
  return expandTokens(tokenize(question));
}

/** Synonym expansion for tokens that are already tokenized (see tokenize). */
export function expandTokens(tokens: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (t: string) => {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  for (const token of tokens) {
    push(token);
    for (const synonym of SYNONYMS[token] ?? []) push(synonym);
  }
  return out;
}

export interface ScoredStop extends FlightStop {
  score: number;
}

/** Scores every facet and returns the best facet per star, strongest first. */
export function scoreFacets(question: string, record: WorkRecord): ScoredStop[] {
  return scoreTerms(expandQuestion(question), record);
}

/** Like scoreFacets, but for terms already tokenized and expanded (see expandQuestion). */
export function scoreTerms(terms: readonly string[], record: WorkRecord): ScoredStop[] {
  const index = buildRouterIndex(record);
  if (terms.length === 0) return [];

  const bestPerStar = new Map<string, { entry: IndexedFacet; score: number }>();
  for (const entry of index.facets) {
    let score = 0;
    for (const term of terms) {
      const weight = index.idf.get(term);
      if (!weight) continue;
      if (entry.tag.has(term)) score += TAG_WEIGHT * weight;
      if (entry.label.has(term)) score += LABEL_WEIGHT * weight;
      if (entry.text.has(term)) score += TEXT_WEIGHT * weight;
    }
    if (score <= 0) continue;
    const current = bestPerStar.get(entry.star.id);
    if (!current || score > current.score) bestPerStar.set(entry.star.id, { entry, score });
  }

  return [...bestPerStar.values()]
    .sort((a, b) => b.score - a.score || a.entry.order - b.entry.order)
    .map(({ entry, score }) => ({ starId: entry.star.id, facetId: entry.facet.id, score }));
}

/** Up to MAX_STOPS stops, one facet per star, above the thresholds; [] means none. */
export function localRoute(question: string, record: WorkRecord): FlightStop[] {
  try {
    if (isDeniedQuestion(normalizeQuestion(question))) return [];
    const scored = scoreFacets(question, record);
    if (scored.length === 0) return [];
    const top = scored[0].score;
    if (top < MIN_SCORE) return [];
    return scored
      .filter((stop) => stop.score >= MIN_SCORE && stop.score >= top * MIN_RELATIVE)
      .slice(0, MAX_STOPS)
      .map(({ starId, facetId }) => ({ starId, facetId }));
  } catch {
    return [];
  }
}
