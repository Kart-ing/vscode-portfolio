// Renders /llms.txt: plain Markdown generated from the record so agents and
// crawlers can read the whole thing without JavaScript.

import type { SourceLink, Star, WorkRecord } from "@/lib/contract";

function links(items: readonly SourceLink[]): string {
  return items.map((link) => `[${link.label}](${link.url})`).join(", ");
}

function starHeading(star: Star): string {
  return star.period ? `### ${star.label} (${star.period})` : `### ${star.label}`;
}

export function renderLlmsTxt(record: WorkRecord, siteUrl: string): string {
  const out: string[] = [];
  const { owner } = record;

  out.push(`# ${owner.name}`);
  out.push("");
  out.push(owner.role);
  out.push("");
  out.push(`> ${owner.tagline}`);
  out.push("");
  if (owner.links.length > 0) {
    out.push(`Links: ${links(owner.links)}`);
    out.push("");
  }
  out.push(`Site: ${siteUrl}`);
  out.push("");

  const facetsByStar = new Map<string, WorkRecord["facets"]>();
  for (const facet of record.facets) {
    const list = facetsByStar.get(facet.starId) ?? [];
    list.push(facet);
    facetsByStar.set(facet.starId, list);
  }

  const sections: { id: string; label: string }[] = [...record.constellations];
  for (const star of record.stars) {
    if (!sections.some((section) => section.id === star.constellation)) {
      sections.push({ id: star.constellation, label: star.constellation });
    }
  }

  for (const section of sections) {
    const stars = record.stars.filter((star) => star.constellation === section.id);
    if (stars.length === 0) continue;
    out.push(`## ${section.label}`);
    out.push("");
    for (const star of stars) {
      out.push(starHeading(star));
      out.push("");
      out.push(star.summary);
      out.push("");
      for (const facet of facetsByStar.get(star.id) ?? []) {
        const source = facet.source ? ` ([${facet.source.label}](${facet.source.url}))` : "";
        out.push(`- ${facet.text}${source}`);
      }
      if (star.links.length > 0) {
        out.push(`- Links: ${links(star.links)}`);
      }
      out.push("");
    }
  }

  out.push("## Machine-readable");
  out.push("");
  out.push(`- The full record as JSON: ${siteUrl}/record.json`);
  out.push(
    "- Every claim on this page comes from the owner's verified record; nothing here is generated, and each item links to its evidence.",
  );
  out.push("");

  return out.join("\n");
}
