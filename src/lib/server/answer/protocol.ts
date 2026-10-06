// The model's output protocol for typed questions. It is extractive: the model
// returns one JSON object, {"ids": ["<facet id>", ...]}, and nothing it writes
// is ever shown. The server keeps only ids that are in the question's
// candidate set (see gate.ts), in the model's order, deduplicated and capped
// at MAX_SENTENCES, and renders each kept facet's own text. Prose around the
// object, ids outside the set (valid ones included), invented ids, non-string
// entries and output without a parseable object are all dropped. Nothing here
// throws.

import { MAX_SENTENCES } from "@/lib/contract";

/** The most model output read; the rest is never parsed. */
export const MAX_MODEL_OUTPUT_CHARS = 4000;

/** Phrasing that reveals where a fact came from instead of what the work is. */
const LEAKED = /\b(?:tagline|taglines|devpost)\b/i;

export function isLeakedPhrasing(text: string): boolean {
  return LEAKED.test(text);
}

/** A flat JSON object: {"ids": [...]} never nests braces. */
const OBJECT = /\{[^{}]*\}/g;

/**
 * The string entries of the first {"ids": [...]} object in the model's
 * output, or null when the output holds no such object (malformed output).
 * Anything around the object is ignored, never shown.
 */
export function parseModelIds(output: string): string[] | null {
  const text = output.slice(0, MAX_MODEL_OUTPUT_CHARS);
  for (const match of text.matchAll(OBJECT)) {
    let value: unknown;
    try {
      value = JSON.parse(match[0]);
    } catch {
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const ids = (value as { ids?: unknown }).ids;
    if (!Array.isArray(ids)) continue;
    return ids.filter((id): id is string => typeof id === "string");
  }
  return null;
}

/** The ids the server renders: only candidates, in the model's order, deduplicated, at most MAX_SENTENCES. */
export function gateIds(ids: readonly string[], candidates: ReadonlySet<string>): string[] {
  const kept: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!candidates.has(id) || kept.includes(id)) continue;
    kept.push(id);
    if (kept.length >= MAX_SENTENCES) break;
  }
  return kept;
}
