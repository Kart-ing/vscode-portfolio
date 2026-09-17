// The relevance guard against the real record, for the question that showed
// the problem: "What has Kartikey built with TypeScript?". Content details
// are looked up, not assumed, so a record change skips rather than breaks.

import { describe, expect, it } from "vitest";
import { record } from "@/content/record";
import { localAnswerStops } from "@/lib/server/answer/local";
import { buildTruthIndex, validateSay } from "@/lib/server/answer/protocol";
import { stackTermsIn } from "@/lib/server/answer/stack-terms";
import { normalizeQuestion } from "@/lib/server/flight/text";

const QUESTION = "What has Kartikey built with TypeScript?";
const index = buildTruthIndex(record);
const options = { stackTerms: stackTermsIn(normalizeQuestion(QUESTION), index.vocabulary) };
const facet = (id: string) => record.facets.find((f) => f.id === id);
const star = (id: string) => record.stars.find((s) => s.id === id);
const hasTs = (id: string) => (star(id)?.stack ?? []).some((s) => s.toLowerCase() === "typescript");

describe("TypeScript question against the real record", () => {
  it("names TypeScript as a stack term", () => {
    expect(options.stackTerms).toContain("typescript");
  });

  it.skipIf(!facet("multiverse.what") || !hasTs("multiverse"))("keeps Multiverse, which declares TypeScript", () => {
    expect(validateSay("Kartikey built Multiverse, a branch predictor for tool calls. [multiverse.what]", index, options)).not.toBeNull();
  });

  it.skipIf(!facet("acrn.build") || hasTs("acrn"))("drops ACRN, which is HTML, CSS and vanilla JS", () => {
    expect(validateSay("Kartikey hand-wrote the ACRN site in HTML, CSS and vanilla JS. [acrn.build]", index, options)).toBeNull();
  });

  it.skipIf(!facet("hackpsu-spring-2023.what") || hasTs("hackpsu-spring-2023"))("drops SignEase, and its tagline phrasing", () => {
    expect(
      validateSay("Kartikey built SignEase for ASL sign language translation in banking. [hackpsu-spring-2023.what]", index, options),
    ).toBeNull();
    expect(
      validateSay("Kartikey built SignEase with Devpost tagline about ASL sign language translation in banking. [hackpsu-spring-2023.what]", index),
    ).toBeNull();
  });

  it.skipIf(!facet("hackharvard-2023.what") || hasTs("hackharvard-2023"))("drops EyeSnap, which is React Native and TensorFlow", () => {
    expect(validateSay("Kartikey built EyeSnap, a diabetic retinopathy detector in React Native. [hackharvard-2023.what]", index, options)).toBeNull();
  });

  it("narrates only stars that carry TypeScript in the local fallback", () => {
    const stops = localAnswerStops(QUESTION, record);
    expect(stops.length).toBeGreaterThan(0);
    for (const stop of stops) {
      const inStack = hasTs(stop.starId);
      const inFacet = /typescript/i.test(facet(stop.facetId)?.text ?? "");
      expect(inStack || inFacet, `${stop.starId} / ${stop.facetId}`).toBe(true);
      expect(facet(stop.facetId)?.text ?? "").not.toMatch(/tagline|devpost/i);
    }
  });
});
