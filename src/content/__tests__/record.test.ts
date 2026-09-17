import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Relative imports only: vitest runs without the "@/" alias.
import { MAX_QUESTION_CHARS, MAX_STOPS } from "../../lib/contract";
import type { ConstellationId } from "../../lib/contract";
import { chips } from "../chips";
import { record } from "../record";
import { advocate, highlights, tour } from "../scripts";

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FACET_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_FACET_CHARS = 200;

const starIds = new Set(record.stars.map((s) => s.id));
const facetIds = new Set(record.facets.map((f) => f.id));
const facetsByStar = new Map<string, number>();
for (const f of record.facets) {
  facetsByStar.set(f.starId, (facetsByStar.get(f.starId) ?? 0) + 1);
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dupes.add(v);
    seen.add(v);
  }
  return [...dupes];
}

describe("record: owner", () => {
  it("has a name, role, tagline and links", () => {
    expect(record.owner.name).toBe("Kartikey Pandey");
    expect(record.owner.role).toBe("Founder, Karts");
    expect(record.owner.tagline.length).toBeGreaterThan(20);
    expect(record.owner.links.length).toBeGreaterThan(0);
  });

  it("owner links are https, or at most one mailto", () => {
    let mailto = 0;
    for (const link of record.owner.links) {
      if (link.url.startsWith("mailto:")) {
        mailto += 1;
      } else {
        expect(link.url, link.label).toMatch(/^https:\/\//);
      }
      expect(link.label.length).toBeGreaterThan(0);
    }
    expect(mailto).toBeLessThanOrEqual(1);
  });
});

describe("record: ids", () => {
  it("star ids are unique and kebab-case", () => {
    const ids = record.stars.map((s) => s.id);
    expect(duplicates(ids)).toEqual([]);
    for (const id of ids) expect(id, id).toMatch(KEBAB);
  });

  it("facet ids are unique and take the form <starId>.<slug>", () => {
    const ids = record.facets.map((f) => f.id);
    expect(duplicates(ids)).toEqual([]);
    for (const id of ids) expect(id, id).toMatch(FACET_ID);
  });

  it("constellation ids are unique and kebab-case", () => {
    const ids = record.constellations.map((c) => c.id);
    expect(duplicates(ids)).toEqual([]);
    for (const id of ids) expect(id, id).toMatch(KEBAB);
  });

  it("star ids never contain a dot, so facet ids parse unambiguously", () => {
    for (const s of record.stars) expect(s.id).not.toContain(".");
  });
});

describe("record: facets", () => {
  it("every facet's starId exists and prefixes its id", () => {
    for (const f of record.facets) {
      expect(starIds.has(f.starId), `${f.id} -> ${f.starId}`).toBe(true);
      expect(f.id.startsWith(`${f.starId}.`), f.id).toBe(true);
    }
  });

  it("every star has at least 1 facet", () => {
    for (const s of record.stars) {
      expect(facetsByStar.get(s.id) ?? 0, s.id).toBeGreaterThanOrEqual(1);
    }
  });

  it("every star has between 2 and 4 facets (writing rule)", () => {
    for (const s of record.stars) {
      const n = facetsByStar.get(s.id) ?? 0;
      expect(n, s.id).toBeGreaterThanOrEqual(2);
      expect(n, s.id).toBeLessThanOrEqual(4);
    }
  });

  it("facet text is one non-empty line of at most 200 characters", () => {
    for (const f of record.facets) {
      expect(f.text.trim().length, f.id).toBeGreaterThan(0);
      expect(f.text.length, `${f.id} is ${f.text.length} chars`).toBeLessThanOrEqual(
        MAX_FACET_CHARS,
      );
      expect(f.text, f.id).not.toMatch(/[\r\n]/);
      expect(f.text, f.id).toBe(f.text.trim());
    }
  });

  it("facet source links are https", () => {
    for (const f of record.facets) {
      if (!f.source) continue;
      expect(f.source.url, f.id).toMatch(/^https:\/\//);
      expect(f.source.label.length, f.id).toBeGreaterThan(0);
    }
  });
});

describe("record: stars", () => {
  it("star links are https with labels", () => {
    for (const s of record.stars) {
      for (const link of s.links) {
        expect(link.url, `${s.id}: ${link.label}`).toMatch(/^https:\/\//);
        expect(link.label.length, s.id).toBeGreaterThan(0);
      }
    }
  });

  it("star summaries and labels are one non-empty line", () => {
    for (const s of record.stars) {
      expect(s.label.trim().length, s.id).toBeGreaterThan(0);
      expect(s.summary.trim().length, s.id).toBeGreaterThan(0);
      expect(s.summary, s.id).not.toMatch(/[\r\n]/);
      expect(s.summary.length, s.id).toBeLessThanOrEqual(MAX_FACET_CHARS);
    }
  });

  it("tags are lowercase, non-empty and unique per star", () => {
    for (const s of record.stars) {
      expect(s.tags.length, s.id).toBeGreaterThan(0);
      expect(duplicates(s.tags), s.id).toEqual([]);
      for (const t of s.tags) {
        expect(t, `${s.id}: ${t}`).toBe(t.toLowerCase().trim());
        expect(t.length).toBeGreaterThan(0);
      }
    }
  });

  it("weights are 1, 2 or 3, and Karts is the brightest", () => {
    for (const s of record.stars) expect([1, 2, 3], s.id).toContain(s.weight);
    const karts = record.stars.find((s) => s.id === "karts");
    expect(karts?.weight).toBe(3);
  });

  it("the twelve hackathon wins are each an award star", () => {
    const awards = record.stars.filter((s) => s.constellation === "hackathons");
    expect(awards).toHaveLength(12);
    for (const s of awards) expect(s.kind, s.id).toBe("award");
  });
});

describe("record: constellations", () => {
  it("every constellation a star uses is listed", () => {
    const listed = new Set<ConstellationId>(record.constellations.map((c) => c.id));
    for (const s of record.stars) {
      expect(listed.has(s.constellation), `${s.id} -> ${s.constellation}`).toBe(true);
    }
  });

  it("every listed constellation has at least one star", () => {
    const used = new Set(record.stars.map((s) => s.constellation));
    for (const c of record.constellations) {
      expect(used.has(c.id), c.id).toBe(true);
      expect(c.label.trim().length, c.id).toBeGreaterThan(0);
    }
  });
});

describe("chips", () => {
  it("there are 4 to 6 chips with unique questions and labels", () => {
    expect(chips.length).toBeGreaterThanOrEqual(4);
    expect(chips.length).toBeLessThanOrEqual(6);
    expect(duplicates(chips.map((c) => c.question))).toEqual([]);
    expect(duplicates(chips.map((c) => c.label))).toEqual([]);
  });

  it("questions fit the API limit", () => {
    for (const c of chips) {
      const q = c.question.trim();
      expect(q.length, c.label).toBeGreaterThanOrEqual(1);
      expect(q.length, c.label).toBeLessThanOrEqual(MAX_QUESTION_CHARS);
      expect(c.question).toBe(q);
    }
  });

  it("each chip has 1 to MAX_STOPS stops that exist in the record", () => {
    for (const c of chips) {
      expect(c.stops.length, c.label).toBeGreaterThanOrEqual(1);
      expect(c.stops.length, c.label).toBeLessThanOrEqual(MAX_STOPS);
      expect(duplicates(c.stops.map((s) => s.facetId)), c.label).toEqual([]);
      for (const stop of c.stops) {
        expect(starIds.has(stop.starId), `${c.label}: ${stop.starId}`).toBe(true);
        expect(facetIds.has(stop.facetId), `${c.label}: ${stop.facetId}`).toBe(true);
        const facet = record.facets.find((f) => f.id === stop.facetId);
        expect(facet?.starId, `${c.label}: ${stop.facetId}`).toBe(stop.starId);
      }
    }
  });
});

describe("privacy scan", () => {
  // Everything a visitor can read: the record, the chips and the scripts.
  const scripts = JSON.stringify({ advocate, highlights, tour });
  const serialized = `${JSON.stringify(record)}\n${JSON.stringify(chips)}\n${scripts}`;

  // Generic personal data. Owner-specific terms live in privacy.local.json,
  // which is git-ignored so the terms themselves never reach the public repo.
  const patterns: { name: string; re: RegExp }[] = [
    { name: "phone number", re: /\d{3}[- ]\d{3}[- ]\d{4}/ },
    { name: "phone number (parenthesised)", re: /\(\d{3}\)\s?\d{3}[- ]\d{4}/ },
    { name: "international phone", re: /\+\d{1,3}[- ]?\d{5,}/ },
    { name: "date of birth", re: /date of birth/i },
    { name: "born", re: /\bborn\b/i },
    { name: "birthday", re: /\bbirthday\b/i },
    { name: "visa", re: /\bvisa\b/i },
    { name: "immigration", re: /\bimmigration\b/i },
    { name: "GPA", re: /\bGPA\b/ },
    { name: "years old", re: /years old/i },
    { name: "age", re: /\bage(?:d)? \d{1,2}\b/i },
  ];

  const localFile = new URL("./privacy.local.json", import.meta.url);
  if (existsSync(localFile)) {
    const local = JSON.parse(readFileSync(localFile, "utf8")) as {
      name: string;
      source: string;
      flags?: string;
    }[];
    for (const { name, source, flags } of local) patterns.push({ name, re: new RegExp(source, flags) });
  }

  for (const { name, re } of patterns) {
    it(`contains no ${name}`, () => {
      const match = serialized.match(re);
      expect(match, match ? `found "${match[0]}"` : "").toBeNull();
    });
  }

  it("only the owner email appears, and only in owner links", () => {
    const emails = serialized.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [];
    expect(new Set(emails)).toEqual(new Set(["kartikeypandey.official@gmail.com"]));
    const outsideOwner = `${JSON.stringify({ ...record, owner: undefined })}\n${JSON.stringify(chips)}\n${scripts}`;
    expect(outsideOwner).not.toMatch(/@/);
  });

  it("never refers to the owner as he or she", () => {
    const text = [
      ...record.stars.map((s) => s.summary),
      ...record.facets.map((f) => f.text),
      ...record.stars.flatMap((s) => (s.media ?? []).map((m) => m.alt)),
      ...chips.map((c) => c.question),
      ...chips.flatMap((c) => (c.sentences ?? []).map((s) => s.text)),
      ...advocate.sentences.map((s) => s.text),
      ...highlights.sentences.map((s) => s.text),
      ...tour.map((t) => t.sentence.text),
    ].join("\n");
    expect(text).not.toMatch(/\b(?:he|she|his|her|him)\b/i);
  });
});
