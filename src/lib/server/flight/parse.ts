// Parses model output into stops. Only tokens that exactly match a known facet
// id survive, so prose, injected instructions and invented ids fall away.

import { MAX_STOPS, type Facet, type FlightStop } from "@/lib/contract";

/** Candidate id-like tokens: letters, digits, dots, dashes and underscores. */
const TOKEN = /[A-Za-z0-9][A-Za-z0-9._-]*/g;

export function parseModelOutput(
  output: string,
  facetsById: ReadonlyMap<string, Facet>,
  max: number = MAX_STOPS,
): FlightStop[] {
  const stops: FlightStop[] = [];
  const seen = new Set<string>();
  for (const match of output.matchAll(TOKEN)) {
    // Strip trailing sentence punctuation that the regex kept ("karts.what.").
    const id = match[0].replace(/[._-]+$/, "");
    const facet = facetsById.get(id);
    if (!facet || seen.has(id)) continue;
    seen.add(id);
    stops.push({ starId: facet.starId, facetId: facet.id });
    if (stops.length >= max) break;
  }
  return stops;
}

/** True when the model explicitly answered NONE (and nothing else usable). */
export function modelSaidNone(output: string): boolean {
  return /\bNONE\b/.test(output);
}

export function facetMap(facets: readonly Facet[]): Map<string, Facet> {
  const map = new Map<string, Facet>();
  for (const facet of facets) map.set(facet.id, facet);
  return map;
}
