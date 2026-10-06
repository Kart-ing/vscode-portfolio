// The relevance gate against the real record, for the question that first
// showed the problem: "What has Kartikey built with TypeScript?". Content
// details are looked up, not assumed.

import { describe, expect, it } from "vitest";
import { record } from "@/content/record";
import { MAX_CANDIDATES, answerCandidates } from "@/lib/server/answer/gate";
import { localAnswerStops } from "@/lib/server/answer/local";
import { isLeakedPhrasing } from "@/lib/server/answer/protocol";

const QUESTION = "What has Kartikey built with TypeScript?";
const facet = (id: string) => record.facets.find((f) => f.id === id);
const star = (id: string) => record.stars.find((s) => s.id === id);
const tsStack = (starId: string) => (star(starId)?.stack ?? []).some((s) => s.toLowerCase() === "typescript");

describe("TypeScript question against the real record", () => {
  const { candidates, answer } = answerCandidates(QUESTION, record);

  it("offers the model only stars that carry TypeScript, at most K lines", () => {
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(MAX_CANDIDATES);
    for (const stop of candidates) {
      const tsLine = record.facets.some((f) => f.starId === stop.starId && /typescript/i.test(f.text));
      expect(tsStack(stop.starId) || tsLine, stop.facetId).toBe(true);
    }
  });

  it("never offers a line that only says where a fact came from", () => {
    for (const stop of candidates) expect(isLeakedPhrasing(facet(stop.facetId)?.text ?? ""), stop.facetId).toBe(false);
  });

  it("draws the router's own answer from the candidates, each line carrying TypeScript", () => {
    expect(answer.length).toBeGreaterThan(0);
    for (const stop of answer) {
      expect(candidates).toContainEqual(stop);
      expect(tsStack(stop.starId) || /typescript/i.test(facet(stop.facetId)?.text ?? ""), stop.facetId).toBe(true);
    }
  });

  it("agrees with the router's own TypeScript stars", () => {
    const routed = new Set(localAnswerStops(QUESTION, record).map((s) => s.starId));
    for (const stop of answer) expect(routed.has(stop.starId), stop.starId).toBe(true);
  });
});

describe("a name the record never mentions", () => {
  it("gets no answer, whatever the question's other words reach", () => {
    for (const q of [
      "Did Kartikey work at NASA?",
      "Is Kartikey a NASA engineer?",
      "Did Kartikey work at Google?",
      "Tell me about the Lunar Autonomy Challenge",
      "Was he a GDSC president?",
      "Did he win HackMIT?",
      "Did he intern at Microsoft?",
    ]) {
      expect(answerCandidates(q, record).candidates, q).toEqual([]);
    }
  });

  it("never blocks a name the record has, with or without a company suffix", () => {
    for (const q of [
      "Has he worked for Intel?",
      "Did he get a grant from Snap Inc?",
      "What did he win at HackHarvard?",
      "Who did he build AgentOverflow with?",
      "What Has He Built With TypeScript?",
    ]) {
      expect(answerCandidates(q, record).candidates.length, q).toBeGreaterThan(0);
    }
  });
});

describe("an anchor the question's other words can't place", () => {
  const starsFor = (q: string) => new Set(answerCandidates(q, record).candidates.map((c) => c.starId));

  it('"work with Snap" keeps the star Snap names, the accelerator, not the Snap AR prize', () => {
    expect(starsFor("Did he work with Snap?")).toEqual(new Set(["snap-accelerator"]));
  });

  it("other words that do choose still win: Spectacles reaches the Snap AR prize too", () => {
    expect(starsFor("What did he build for Snap Spectacles?").has("hackpsu-fall-2024")).toBe(true);
  });
});
