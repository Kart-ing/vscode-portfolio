import { record } from "@/content/record";
import type {
  ConstellationId,
  Facet,
  SourceLink,
  Star,
  StarKind,
} from "@/lib/contract";

const starById = new Map<string, Star>(record.stars.map((star) => [star.id, star]));
const facetById = new Map<string, Facet>(record.facets.map((facet) => [facet.id, facet]));
const facetsByStar = new Map<string, Facet[]>();
for (const facet of record.facets) {
  const list = facetsByStar.get(facet.starId);
  if (list) list.push(facet);
  else facetsByStar.set(facet.starId, [facet]);
}
const constellationLabel = new Map<ConstellationId, string>(
  record.constellations.map((c) => [c.id, c.label]),
);

export const KIND_LABEL: Record<StarKind, string> = {
  company: "Company",
  project: "Project",
  paper: "Paper",
  patent: "Patent",
  award: "Award",
  role: "Role",
  education: "Education",
  community: "Community",
};

export function getStar(id: string): Star | undefined {
  return starById.get(id);
}

export function getFacet(id: string): Facet | undefined {
  return facetById.get(id);
}

export function getFacets(starId: string): Facet[] {
  return facetsByStar.get(starId) ?? [];
}

export function getConstellationLabel(id: ConstellationId): string {
  return constellationLabel.get(id) ?? id;
}

export function starsIn(constellation: ConstellationId): Star[] {
  return record.stars.filter((star) => star.constellation === constellation);
}

/** Evidence for a card: the highlighted line's source first, then the star's links, then other lines' sources. */
export function evidenceFor(star: Star, primary: Facet | undefined, others: Facet[]): SourceLink[] {
  const out: SourceLink[] = [];
  const seen = new Set<string>();
  const push = (link?: SourceLink) => {
    if (!link || seen.has(link.url)) return;
    seen.add(link.url);
    out.push(link);
  };
  push(primary?.source);
  for (const link of star.links) push(link);
  for (const facet of others) push(facet.source);
  return out.slice(0, 6);
}

export function isExternal(url: string): boolean {
  return /^https?:\/\//.test(url);
}
