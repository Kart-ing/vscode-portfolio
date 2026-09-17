import { describe, expect, it } from "vitest";
import { MAX_STOPS, type WorkRecord } from "@/lib/contract";
import { MAX_BEAMS, MIN_BEAMS, beamsFor, localAnswerStops, rankStars } from "@/lib/server/answer/local";
import { fixtureRecord } from "./fixture";

const stops = (q: string) => localAnswerStops(q, fixtureRecord);
const facetIds = (q: string) => stops(q).map((s) => s.facetId);
const starIds = (q: string) => stops(q).map((s) => s.starId);
const beams = (q: string) => beamsFor(q, fixtureRecord);
const allStars = new Set(fixtureRecord.stars.map((s) => s.id));

describe("best intent", () => {
  it("picks the strongest facets of weight 2-3 stars when the question has no topic", () => {
    for (const q of ["what is his best work", "what is he most proud of", "flagship project", "top 3 achievements so far"]) {
      expect(rankStars(q, fixtureRecord).intent, q).toBe("best");
      expect(facetIds(q), q).toEqual(["karts.what", "multiverse.what", "patent.what", "hackmit.win"]);
    }
  });

  it("keeps the topic when the question has one", () => {
    expect(facetIds("best hackathon win")).toEqual(["hackmit.win"]);
    expect(facetIds("proudest research")[0]).toMatch(/^(patent|signal-paper)\./);
  });
});

describe("stack intent", () => {
  it("routes a named technology to the stars that declare it, naming facets that mention it", () => {
    const q = "What has Kartikey built with Python?";
    expect(rankStars(q, fixtureRecord).intent).toBe("stack");
    expect(starIds(q)).toEqual(["multiverse", "hackmit"]);
    expect(facetIds(q)[0]).toBe("multiverse.stack");
  });

  it("answers a bare stack question with the brightest stars that have a stack", () => {
    const q = "what's his tech stack";
    expect(rankStars(q, fixtureRecord).intent).toBe("stack");
    expect(starIds(q)).toEqual(["karts", "multiverse", "hackmit", "acme"]);
    expect(facetIds(q)).toContain("multiverse.stack");
  });

  it("never lists a star without a stack for a bare stack question", () => {
    for (const q of ["what languages does he know", "which tools does he code with"]) {
      for (const starId of starIds(q)) {
        expect(fixtureRecord.stars.find((s) => s.id === starId)?.stack, `${q} -> ${starId}`).toBeDefined();
      }
    }
  });

  it("returns only stars that carry a named technology, in their stack or in a facet", () => {
    for (const q of ["What has Kartikey built with TypeScript?", "typescript projects", "TypeScript"]) {
      expect(rankStars(q, fixtureRecord).intent, q).toBe("stack");
      // karts declares TypeScript; the club names it only in a facet's text.
      expect(starIds(q), q).toEqual(["karts", "robotics-club"]);
      expect(facetIds(q), q).toContain("robotics-club.site");
      expect(beams(q), q).toContain("karts");
      expect(beams(q), q).toContain("robotics-club");
    }
    // A multi-word entry matches as a phrase and by its distinctive word.
    expect(starIds("lens studio work")).toEqual(["hackmit"]);
    expect(starIds("anything with lens")).toEqual(["hackmit"]);
    // "node" alone reaches Node.js.
    expect(starIds("node projects")).toEqual(["karts", "robotics-club"]);
  });

  it("lets a facet that only quotes where a fact came from yield to a sibling", () => {
    // The tagline facet scores highest on these words; the win facet speaks instead.
    const ids = facetIds("books restaurant tables by phone");
    expect(ids).toContain("hackmit.win");
    expect(ids).not.toContain("hackmit.tagline");
  });
});

describe("llm intent", () => {
  it("selects the research and agent-tools stars, best match first", () => {
    for (const q of ["what has he done with LLMs", "machine learning models", "AI agents work", "any ml experience"]) {
      expect(rankStars(q, fixtureRecord).intent, q).toBe("llm");
      const stars = starIds(q);
      expect(stars.length, q).toBeGreaterThan(0);
      for (const starId of stars) expect(["multiverse", "patent", "signal-paper"], `${q} -> ${starId}`).toContain(starId);
    }
    expect(starIds("what agent tools has he built")[0]).toBe("multiverse");
  });

  it("prefers the llm reading over a bare stack word", () => {
    expect(rankStars("what AI agent tools has he built", fixtureRecord).intent).toBe("llm");
    expect(rankStars("language models", fixtureRecord).intent).toBe("llm");
  });
});

describe("keyword routing (V2 behaviour)", () => {
  it("answers topical questions with the matching facet", () => {
    expect(facetIds("any clubs he led")).toEqual(["robotics-club.lead"]);
    expect(facetIds("tell me about the patent")).toEqual(["patent.what"]);
    expect(facetIds("where did he work")).toEqual(["acme.role"]);
    expect(facetIds("what did he study")).toEqual(["state-u.degree"]);
  });

  it("returns nothing only when no keyword hits", () => {
    expect(stops("does he like jazz")).toEqual([]);
    expect(stops("asdf qwer zxcv")).toEqual([]);
    expect(stops("")).toEqual([]);
  });

  it("returns one facet per star and at most MAX_STOPS", () => {
    const result = stops("karts startup ide coding servers founder hackathon patent paper intern club university");
    expect(result.length).toBeLessThanOrEqual(MAX_STOPS);
    expect(new Set(result.map((s) => s.starId)).size).toBe(result.length);
  });
});

describe("beamsFor", () => {
  it("returns 3 to 6 known star ids, matches first", () => {
    for (const q of [
      "tell me about the patent",
      "what is his best work",
      "karts startup ide coding servers founder hackathon patent paper intern club university",
      "does he like jazz",
    ]) {
      const ids = beams(q);
      expect(ids.length, q).toBeGreaterThanOrEqual(MIN_BEAMS);
      expect(ids.length, q).toBeLessThanOrEqual(MAX_BEAMS);
      expect(new Set(ids).size, q).toBe(ids.length);
      for (const id of ids) expect(allStars.has(id), `${q} -> ${id}`).toBe(true);
    }
    expect(beams("tell me about the patent")[0]).toBe("patent");
    expect(beams("where did he work")[0]).toBe("acme");
  });

  it("pads a thin match with weaker candidates, then the brightest stars, and covers every answered star", () => {
    // The paper shares the patent's constellation, so it is a (weak) candidate; karts is padding.
    expect(beams("tell me about the patent")).toEqual(["patent", "signal-paper", "karts"]);
    expect(beams("does he like jazz")).toEqual(["karts", "multiverse", "patent"]);
    const q = "what is his best work";
    for (const starId of starIds(q)) expect(beams(q)).toContain(starId);
  });
});

describe("robustness", () => {
  it("never throws on a broken record", () => {
    const broken = {
      ...fixtureRecord,
      facets: [{ id: "ghost.x", starId: "ghost", text: "orphan facet" }],
    } as WorkRecord;
    expect(localAnswerStops("orphan facet", broken)).toEqual([]);
    expect(beamsFor("orphan facet", broken)).toEqual([]);
    expect(localAnswerStops("anything", { ...fixtureRecord, stars: [], facets: [] })).toEqual([]);
  });

  it("is fast", () => {
    const questions = ["what is karts", "best hackathon win", "built with python", "llm work", "where did he work"];
    beamsFor("warm up", fixtureRecord);
    const runs = 200;
    const start = performance.now();
    for (let i = 0; i < runs; i += 1) {
      localAnswerStops(questions[i % questions.length], fixtureRecord);
      beamsFor(questions[i % questions.length], fixtureRecord);
    }
    expect((performance.now() - start) / runs).toBeLessThan(5);
  });
});
