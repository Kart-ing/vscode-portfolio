import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Relative imports only: vitest runs without the "@/" alias.
import {
  MAX_SENTENCES,
  MAX_STOPS,
  TIMELINE_END_YEAR,
  TIMELINE_START_YEAR,
} from "../../lib/contract";
import type { AnswerSentence, FlightStop, GeneratedView } from "../../lib/contract";
import { chips } from "../chips";
import { record } from "../record";
import { advocate, highlights, tour } from "../scripts";

const MEDIA_DIR = fileURLToPath(new URL("../../../public/media/", import.meta.url));
const MAX_MEDIA_BYTES = 350 * 1024;
const MAX_SENTENCE_WORDS = 40;

const facetById = new Map(record.facets.map((f) => [f.id, f]));
const starById = new Map(record.stars.map((s) => [s.id, s]));
const constellationIds = new Set(record.constellations.map((c) => c.id));
const winStarIds = record.stars.filter((s) => s.constellation === "hackathons").map((s) => s.id);

/** Every curated answer, labelled for failure messages. */
const answers: { name: string; sentences: AnswerSentence[]; view?: GeneratedView }[] = [
  { name: "advocate", sentences: advocate.sentences, view: advocate.view },
  { name: "highlights", sentences: highlights.sentences, view: highlights.view },
  { name: "tour", sentences: tour.map((t) => t.sentence) },
  ...chips.map((c) => ({ name: `chip "${c.label}"`, sentences: c.sentences ?? [], view: c.view })),
];

const sentences = answers.flatMap((a) =>
  a.sentences.map((s, i) => ({ where: `${a.name} #${i + 1}`, ...s })),
);

/** Numbers as a model or a visitor reads them: 12x, $1,000, #185, 97%, 2026, 1.5B, c0mpiled-11. */
function numberTokens(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((raw) => {
    const n = Number(raw.replace(/,/g, ""));
    return Number.isFinite(n) ? String(n) : raw;
  });
}

function stopsOf(list: AnswerSentence[]): FlightStop[] {
  const seen = new Set<string>();
  const stops: FlightStop[] = [];
  for (const s of list) {
    const first = s.citations[0];
    if (!first || seen.has(first.facetId)) continue;
    seen.add(first.facetId);
    stops.push(first);
  }
  return stops.slice(0, MAX_STOPS);
}

function expectValidView(view: GeneratedView | undefined, where: string) {
  if (!view) return;
  if (view.kind === "constellation") {
    expect(constellationIds.has(view.constellation), where).toBe(true);
    return;
  }
  expect(view.starIds.length, where).toBeGreaterThan(0);
  expect(new Set(view.starIds).size, `${where}: duplicate star ids`).toBe(view.starIds.length);
  for (const id of view.starIds) {
    expect(starById.has(id), `${where}: ${id}`).toBe(true);
    if (view.kind === "timeline") {
      expect(starById.get(id)?.start, `${where}: timeline star ${id} needs a start`).toBeTruthy();
    }
  }
  if (view.kind === "compare") {
    expect(view.starIds.length, where).toBeGreaterThanOrEqual(2);
    expect(view.starIds.length, where).toBeLessThanOrEqual(3);
  }
}

describe("star metadata: start", () => {
  it("is YYYY-MM within the timeline years", () => {
    for (const s of record.stars) {
      if (s.start === undefined) continue;
      expect(s.start, s.id).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
      const year = Number(s.start.slice(0, 4));
      expect(year, s.id).toBeGreaterThanOrEqual(TIMELINE_START_YEAR);
      expect(year, s.id).toBeLessThanOrEqual(TIMELINE_END_YEAR);
    }
  });

  it("is set on Karts, the hackathon wins and most stars", () => {
    expect(starById.get("karts")?.start).toBe("2026-08");
    for (const id of winStarIds) expect(starById.get(id)?.start, id).toBeTruthy();
    const withStart = record.stars.filter((s) => s.start).length;
    expect(withStart).toBeGreaterThanOrEqual(record.stars.length - 4);
  });

  it("spans 2020 to 2026, so the intro has a full range", () => {
    const years = record.stars.flatMap((s) => (s.start ? [Number(s.start.slice(0, 4))] : []));
    expect(Math.min(...years)).toBe(TIMELINE_START_YEAR);
    expect(Math.max(...years)).toBe(TIMELINE_END_YEAR);
  });
});

describe("star metadata: stack and repo", () => {
  it("stack entries are non-empty display names, unique per star", () => {
    for (const s of record.stars) {
      if (!s.stack) continue;
      expect(s.stack.length, s.id).toBeGreaterThan(0);
      expect(new Set(s.stack).size, `${s.id}: duplicate stack entry`).toBe(s.stack.length);
      for (const t of s.stack) {
        expect(t, s.id).toBe(t.trim());
        expect(t.length, s.id).toBeGreaterThan(0);
      }
    }
  });

  it("repo is a public Kart-ing repo name", () => {
    for (const s of record.stars) {
      if (s.repo === undefined) continue;
      expect(s.repo, s.id).toMatch(/^Kart-ing\/[\w.-]+$/);
    }
    expect(record.stars.filter((s) => s.repo).length).toBeGreaterThanOrEqual(6);
  });
});

describe("star metadata: media", () => {
  const withMedia = record.stars.filter((s) => s.media && s.media.length > 0);

  it("only project, award and paper stars carry media, one image each", () => {
    expect(withMedia.length).toBeGreaterThanOrEqual(9);
    for (const s of withMedia) {
      expect(["project", "award", "paper"], s.id).toContain(s.kind);
      expect(s.media, s.id).toHaveLength(1);
    }
  });

  it("every media file exists under public/media, is a JPEG under 350KB, and is named after its star", () => {
    for (const s of withMedia) {
      for (const m of s.media ?? []) {
        expect(m.kind, s.id).toBe("image");
        expect(m.src, s.id).toBe(`/media/${s.id}.jpg`);
        const file = `${MEDIA_DIR}${s.id}.jpg`;
        expect(existsSync(file), `${s.id}: missing ${file}`).toBe(true);
        expect(statSync(file).size, `${s.id}: over 350KB`).toBeLessThan(MAX_MEDIA_BYTES);
      }
    }
  });

  it("has descriptive alt text, dimensions and an https credit", () => {
    for (const s of withMedia) {
      for (const m of s.media ?? []) {
        expect(m.alt.trim().length, s.id).toBeGreaterThan(10);
        expect(m.alt, s.id).not.toMatch(/[\r\n]/);
        expect(m.width, s.id).toBeGreaterThan(0);
        expect(m.height, s.id).toBeGreaterThan(0);
        expect(m.credit?.url, s.id).toMatch(/^https:\/\//);
        expect(m.credit?.label.length, s.id).toBeGreaterThan(0);
      }
    }
  });

  it("has no orphan files in public/media", () => {
    const referenced = new Set(withMedia.map((s) => `${s.id}.jpg`));
    for (const name of readdirSync(MEDIA_DIR)) {
      if (name.startsWith(".")) continue;
      expect(referenced.has(name), `orphan media file ${name}`).toBe(true);
    }
  });
});

describe("curated sentences", () => {
  it("cite facets that exist and belong to the cited star", () => {
    for (const s of sentences) {
      for (const c of s.citations) {
        const facet = facetById.get(c.facetId);
        expect(facet, `${s.where}: unknown facet ${c.facetId}`).toBeDefined();
        expect(facet?.starId, `${s.where}: ${c.facetId} is not on ${c.starId}`).toBe(c.starId);
        expect(starById.has(c.starId), `${s.where}: unknown star ${c.starId}`).toBe(true);
      }
    }
  });

  it("every sentence is cited, except the scripted Yes.", () => {
    for (const s of sentences) {
      if (s.text === "Yes.") {
        expect(s.citations, s.where).toEqual([]);
        continue;
      }
      expect(s.citations.length, `${s.where}: uncited "${s.text}"`).toBeGreaterThan(0);
    }
  });

  it("is one trimmed line of at most 40 words", () => {
    for (const s of sentences) {
      expect(s.text, s.where).toBe(s.text.trim());
      expect(s.text.length, s.where).toBeGreaterThan(0);
      expect(s.text, s.where).not.toMatch(/[\r\n]/);
      expect(s.text.split(/\s+/).length, `${s.where}: too long`).toBeLessThanOrEqual(MAX_SENTENCE_WORDS);
    }
  });

  it("every number appears in the text of a cited facet", () => {
    for (const s of sentences) {
      const supported = new Set(
        s.citations.flatMap((c) => numberTokens(facetById.get(c.facetId)?.text ?? "")),
      );
      for (const n of numberTokens(s.text)) {
        expect(supported.has(n), `${s.where}: number ${n} is not in a cited facet ("${s.text}")`).toBe(
          true,
        );
      }
    }
  });

  it("never uses pronouns for Kartikey", () => {
    const pronoun = /\b(?:he|she|him|his|her|hers|himself|herself|they|them|their|theirs|themselves)\b/i;
    for (const s of sentences) {
      const match = s.text.match(pronoun);
      expect(match, `${s.where}: found "${match?.[0]}"`).toBeNull();
    }
  });

  it("every answer names Kartikey", () => {
    for (const a of answers) {
      expect(a.sentences.map((s) => s.text).join(" "), a.name).toMatch(/\bKartikey\b/);
    }
  });

  it("every view is valid", () => {
    for (const a of answers) expectValidView(a.view, a.name);
  });
});

describe("chips (V3)", () => {
  it("there are exactly 6 chips, and the first is the advocate answer", () => {
    expect(chips).toHaveLength(6);
    expect(chips[0].question).toBe("Should we hire Kartikey?");
    expect(chips[0].sentences).toBe(advocate.sentences);
    expect(chips[0].view).toEqual(advocate.view);
  });

  it("each chip has 2 to 4 curated sentences", () => {
    for (const c of chips) {
      expect(c.sentences?.length ?? 0, c.label).toBeGreaterThanOrEqual(2);
      expect(c.sentences?.length ?? 0, c.label).toBeLessThanOrEqual(MAX_SENTENCES);
    }
  });

  it("stops are each sentence's first citation, in order, deduplicated, at most MAX_STOPS", () => {
    for (const c of chips) {
      const expected = stopsOf(c.sentences ?? []);
      expect(c.stops, c.label).toEqual(expected);
      expect(c.stops.length, c.label).toBeLessThanOrEqual(MAX_STOPS);
    }
  });

  it("stages the requested views", () => {
    const byLabel = new Map(chips.map((c) => [c.label, c]));
    expect(byLabel.get("Built for AI agents")?.view).toEqual({
      kind: "constellation",
      constellation: "agent-tools",
    });
    const wins = byLabel.get("Hackathon wins")?.view;
    expect(wins?.kind).toBe("timeline");
    expect(wins && "starIds" in wins ? wins.starIds : []).toEqual(winStarIds);
    expect(byLabel.get("Research and patent")?.view).toEqual({
      kind: "compare",
      starIds: ["recompress", "patent"],
    });
    expect(byLabel.has("What is Karts?")).toBe(true);
    expect(byLabel.has("Where has Kartikey worked?")).toBe(true);
  });
});

describe("scripts", () => {
  it("advocate opens with an uncited Yes. and then 3 to 4 cited proof sentences", () => {
    expect(advocate.question).toBe("Should we hire Kartikey?");
    expect(advocate.sentences[0]).toEqual({ text: "Yes.", citations: [] });
    const proof = advocate.sentences.slice(1);
    expect(proof.length).toBeGreaterThanOrEqual(3);
    expect(proof.length).toBeLessThanOrEqual(4);
    for (const s of proof) expect(s.citations.length, s.text).toBeGreaterThan(0);
    expect(proof[0].citations[0]?.starId).toBe("karts");
    expect(advocate.view?.kind).toBe("timeline");
  });

  it("highlights has 3 to 4 cited sentences and a question", () => {
    expect(highlights.question.trim().length).toBeGreaterThan(0);
    expect(highlights.sentences.length).toBeGreaterThanOrEqual(3);
    expect(highlights.sentences.length).toBeLessThanOrEqual(MAX_SENTENCES);
    for (const s of highlights.sentences) expect(s.citations.length, s.text).toBeGreaterThan(0);
  });

  it("the tour has 9 to 12 steps, holds 4 to 7 seconds each, and runs 50 to 75 seconds", () => {
    expect(tour.length).toBeGreaterThanOrEqual(9);
    expect(tour.length).toBeLessThanOrEqual(12);
    let total = 0;
    for (const t of tour) {
      expect(t.holdMs, t.sentence.text).toBeGreaterThanOrEqual(4000);
      expect(t.holdMs, t.sentence.text).toBeLessThanOrEqual(7000);
      expect(t.sentence.citations.length, t.sentence.text).toBeGreaterThan(0);
      total += t.holdMs;
    }
    expect(total).toBeGreaterThanOrEqual(50_000);
    expect(total).toBeLessThanOrEqual(75_000);
  });

  it("the tour starts and ends on Karts and visits every constellation but education", () => {
    const visited = tour.map((t) => t.sentence.citations[0].starId);
    expect(visited[0]).toBe("karts");
    expect(visited[visited.length - 1]).toBe("karts");
    const seen = new Set(visited.map((id) => starById.get(id)?.constellation));
    for (const c of record.constellations) {
      if (c.id === "education" || c.id === "more-projects") continue;
      expect(seen.has(c.id), `tour never visits ${c.id}`).toBe(true);
    }
  });
});
