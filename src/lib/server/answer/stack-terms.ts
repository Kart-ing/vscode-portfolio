// The record's stack vocabulary: every star's `stack` entries, normalized the
// same way as questions, plus the distinctive words inside multi-word entries
// ("Lens Studio" also yields "lens"; "Node.js" also yields "node"). When a
// question names one of these terms, answers must stay on that technology.

import type { WorkRecord } from "@/lib/contract";
import { normalizeQuestion } from "@/lib/server/flight/text";

export interface StackVocabulary {
  /** Normalized term -> ids of the stars whose stack carries it. */
  terms: ReadonlyMap<string, ReadonlySet<string>>;
  /** Normalized terms per star. */
  byStar: ReadonlyMap<string, ReadonlySet<string>>;
}

/** "Go" and "C" are too short to spot in a question; "SQL" and "AWS" are fine. */
const MIN_TERM_CHARS = 3;
/** A word inside a phrase must be this long to stand alone ("lens", not "js"). */
const MIN_WORD_CHARS = 4;
/** Words inside phrases that name nothing on their own. */
const GENERIC_WORDS = new Set([
  "cloud", "native", "studio", "server", "servers", "web", "api", "apis", "engine", "core",
  "kit", "sdk", "lab", "labs", "tool", "tools", "framework", "code", "app", "apps",
  "platform", "service", "services", "meta", "open", "source", "data", "model", "models",
  "learning", "machine", "language", "script", "pro", "plus", "edge", "mini", "max",
]);

const vocabularies = new WeakMap<WorkRecord, StackVocabulary>();

/** Normalized forms of one stack entry: the whole phrase, then its distinctive words. */
export function stackEntryTerms(entry: string): string[] {
  const phrase = normalizeQuestion(entry);
  const out: string[] = [];
  if (phrase.length >= MIN_TERM_CHARS) out.push(phrase);
  for (const word of phrase.split(" ")) {
    if (word.length < MIN_WORD_CHARS || GENERIC_WORDS.has(word) || out.includes(word)) continue;
    out.push(word);
  }
  return out;
}

export function stackVocabulary(record: WorkRecord): StackVocabulary {
  const cached = vocabularies.get(record);
  if (cached) return cached;
  const terms = new Map<string, Set<string>>();
  const byStar = new Map<string, Set<string>>();
  for (const star of record.stars) {
    if (!star.stack || star.stack.length === 0) continue;
    const own = new Set<string>();
    for (const entry of star.stack) {
      for (const term of stackEntryTerms(entry)) {
        own.add(term);
        const stars = terms.get(term) ?? new Set<string>();
        stars.add(star.id);
        terms.set(term, stars);
      }
    }
    if (own.size > 0) byStar.set(star.id, own);
  }
  const vocabulary: StackVocabulary = { terms, byStar };
  vocabularies.set(record, vocabulary);
  return vocabulary;
}

/** Whole-phrase match on text normalized like a question (lowercase, single spaces). */
export function textHasTerm(normalizedText: string, term: string): boolean {
  return ` ${normalizedText} `.includes(` ${term} `);
}

/** The vocabulary terms a normalized question names, longest first. */
export function stackTermsIn(normalizedQuestion: string, vocabulary: StackVocabulary): string[] {
  if (!normalizedQuestion) return [];
  const found: string[] = [];
  for (const term of vocabulary.terms.keys()) {
    if (textHasTerm(normalizedQuestion, term)) found.push(term);
  }
  return found.sort((a, b) => b.length - a.length || a.localeCompare(b));
}
