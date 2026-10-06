import { describe, expect, it } from "vitest";

// Relative imports only: vitest runs without the "@/" alias.
import { UI_ALLOWLIST } from "../allowlist";
import { C1, C11, C2, C3_DATES, C5A, C9, N1, N2, N3, N4_DOI_URL, N5, ROLE_LINE } from "../canonical";
import { chips } from "../chips";
import { record } from "../record";
import { advocate, highlights, tour } from "../scripts";

// The site's cells of the one-story PRD's field matrix and number mapping
// (6 Oct 2026), and the static checks of invariant I1. The canonical strings
// are copied from the PRD verbatim; these tests pin where each one appears.

const star = (id: string) => record.stars.find((s) => s.id === id);
const facet = (id: string) => record.facets.find((f) => f.id === id);
const facetsOf = (id: string) => record.facets.filter((f) => f.starId === id);

const curated = [
  ...advocate.sentences,
  ...highlights.sentences,
  ...tour.map((t) => t.sentence),
  ...chips.flatMap((c) => c.sentences ?? []),
];
/** Everything a visitor can read that the record, scripts and chips supply. */
const everything = [
  JSON.stringify(record),
  JSON.stringify(chips),
  JSON.stringify({ advocate, highlights, tour }),
  JSON.stringify(UI_ALLOWLIST),
].join("\n");

describe("canonical strings (field matrix, site column)", () => {
  it("top line: the page title is the name and the R2 display line", () => {
    // layout.tsx and opengraph-image.tsx build the title as `${name} · ${role}`.
    expect(`${record.owner.name} · ${record.owner.role}`).toBe("Kartikey Pandey · Founder, Karts (part-time)");
    expect(record.owner.role).toBe(ROLE_LINE);
  });

  it("one-liner: the hero tagline, meta and OG description are C1", () => {
    expect(record.owner.tagline).toBe(C1);
  });

  it("about: the summary is C9, verbatim and whole", () => {
    expect(record.owner.about).toEqual([...C9]);
    expect(C9).toHaveLength(5);
  });

  it("roles: each role star shows its C3 dates and carries its C11 sentence as its role facet", () => {
    const roles = [
      ["karts", "karts.founder", C3_DATES.karts, C11.karts],
      ["cara", "cara.role", C3_DATES.cara, C11.cara],
      ["raya-health", "raya-health.role", C3_DATES.raya, C11.raya],
      ["coldstart", "coldstart.role", C3_DATES.coldstart, C11.coldstart],
      ["intel", "intel.role", C3_DATES.intel, C11.intel],
    ] as const;
    for (const [starId, facetId, period, sentence] of roles) {
      expect(star(starId)?.period, starId).toBe(period);
      expect(facet(facetId)?.text, facetId).toBe(sentence);
    }
    expect(star("penn-state")?.period).toBe(C3_DATES.education);
  });

  it("roles: a role star states its role once, in its C11 sentence; other role lines are gone", () => {
    for (const starId of ["cara", "raya-health", "coldstart"]) {
      expect(facetsOf(starId).map((f) => f.text), starId).toEqual([star(starId)?.summary]);
    }
    expect(everything).not.toMatch(/Software Engineer Intern/);
    expect(everything).not.toMatch(/from the ground up/);
    expect(everything).not.toMatch(/residency batch/);
  });

  it('roles: "Founder, Karts" only ever appears as the R2 line, with "(part-time)"', () => {
    expect(everything).not.toMatch(/Founder, Karts(?! \(part-time\))/);
    expect(everything).not.toMatch(/Founder \(part-time\), Karts/);
  });

  it("Karts description and traction: C2 and C5(a) on the Karts star, and no pre-pivot lines", () => {
    expect(star("karts")?.summary).toBe(C2);
    expect(facet("karts.what")?.text).toBe(C2);
    expect(facet("karts.traction")?.text).toBe(C5A);
    expect(everything).not.toMatch(/self-hosted development platform|app hosting|coding servers|simulate load/i);
  });

  it("Karts lines never use the banned traction words", () => {
    const karts = [star("karts")!.summary, ...facetsOf("karts").map((f) => f.text)].join("\n");
    expect(karts).not.toMatch(/\b(?:users?|customers?|launched|ready|live)\b/i);
    expect(karts).not.toMatch(/a team is using it/i);
    expect(karts).not.toMatch(/\bcommits\b|\b\d[\d,]* commit/i);
  });
});

describe("number mapping (site column)", () => {
  it("N1 in the prize-count facet", () => {
    expect(facet("zero-human-company-hackathon.count")?.text).toContain(N1);
  });

  it("N2 on the patent card, with no link to a patent record", () => {
    expect(facetsOf("patent").some((f) => f.text.includes(N2))).toBe(true);
    expect(star("patent")?.links).toEqual([]);
  });

  it("N3 on the prize card", () => {
    expect(facetsOf("berkeley-ai-hackathon-2026").some((f) => f.text.includes(N3))).toBe(true);
  });

  it("N4 as the preprint card link, and the v1 DOI nowhere", () => {
    expect(star("recompress")?.links[0]?.url).toBe(N4_DOI_URL);
    expect(N4_DOI_URL).toBe("https://doi.org/10.5281/zenodo.20787487");
    expect(everything).not.toContain("zenodo.20786357");
  });

  it("N5 in the team facet", () => {
    expect(facetsOf("psu-hackathon-team").some((f) => f.text.includes(N5))).toBe(true);
  });

  it("the prize count is 13 prizes at 12 hackathons wherever a count appears", () => {
    expect(record.stars.filter((s) => s.constellation === "hackathons")).toHaveLength(12);
    for (const s of curated) {
      if (/\bprizes at\b/.test(s.text)) expect(s.text, s.text).toContain(N1);
    }
    expect(everything).not.toMatch(/\b12x\b|hackathon winner|twelfth win/i);
  });
});

describe("invariant I1: static checks", () => {
  /** Sentences of a string, split at sentence ends. */
  const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+/);
  const strings = [
    ...record.facets.map((f) => ({ where: f.id, text: f.text })),
    ...curated.map((s) => ({ where: "script/chip", text: s.text })),
    ...UI_ALLOWLIST.map((text) => ({ where: "allowlist", text })),
  ];

  it('no facet, script or allowlist string contains "Yes."', () => {
    for (const { where, text } of strings) expect(text, where).not.toMatch(/\bYes\./);
  });

  it('no sentence of a facet, script or allowlist string starts with "Yes" or "No"', () => {
    for (const { where, text } of strings) {
      for (const sentence of sentencesOf(text)) expect(sentence, where).not.toMatch(/^["'(]?(?:Yes|No)\b/);
    }
  });

  it("every curated sentence cites at least one facet", () => {
    for (const s of curated) expect(s.citations.length, s.text).toBeGreaterThan(0);
  });
});
