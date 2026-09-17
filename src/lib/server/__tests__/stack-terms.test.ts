import { describe, expect, it } from "vitest";
import { stackEntryTerms, stackTermsIn, stackVocabulary, textHasTerm } from "@/lib/server/answer/stack-terms";
import { normalizeQuestion } from "@/lib/server/flight/text";
import { fixtureRecord } from "./fixture";

const vocabulary = stackVocabulary(fixtureRecord);
const termsIn = (q: string) => stackTermsIn(normalizeQuestion(q), vocabulary);

describe("stackEntryTerms", () => {
  it("normalizes an entry and adds its distinctive words", () => {
    expect(stackEntryTerms("TypeScript")).toEqual(["typescript"]);
    expect(stackEntryTerms("Node.js")).toEqual(["node js", "node"]);
    expect(stackEntryTerms("Lens Studio")).toEqual(["lens studio", "lens"]);
    expect(stackEntryTerms("React Native")).toEqual(["react native", "react"]);
    expect(stackEntryTerms("Qwen2.5-1.5B")).toEqual(["qwen2 5 1 5b", "qwen2"]);
    expect(stackEntryTerms("Google Cloud")).toEqual(["google cloud", "google"]);
  });

  it("drops entries and words too short to spot in a question", () => {
    expect(stackEntryTerms("Go")).toEqual([]);
    expect(stackEntryTerms("C++")).toEqual([]);
    expect(stackEntryTerms("R")).toEqual([]);
    expect(stackEntryTerms("SQL")).toEqual(["sql"]);
    expect(stackEntryTerms("AWS")).toEqual(["aws"]);
  });
});

describe("stackVocabulary", () => {
  it("maps every term to the stars that declare it", () => {
    expect([...vocabulary.terms.get("typescript")!]).toEqual(["karts"]);
    expect([...vocabulary.terms.get("python")!].sort()).toEqual(["hackmit", "multiverse"]);
    expect(vocabulary.terms.has("go")).toBe(false);
    expect(vocabulary.byStar.get("hackmit")).toEqual(new Set(["python", "react", "lens studio", "lens"]));
    expect(vocabulary.byStar.has("patent")).toBe(false);
    expect(stackVocabulary(fixtureRecord)).toBe(vocabulary);
  });
});

describe("stackTermsIn", () => {
  it("finds whole-phrase matches, longest first", () => {
    expect(termsIn("What has Kartikey built with TypeScript?")).toEqual(["typescript"]);
    expect(termsIn("python and react projects")).toEqual(["python", "react"]);
    expect(termsIn("anything in Lens Studio")).toEqual(["lens studio", "lens"]);
    expect(termsIn("node.js work")).toEqual(["node js", "node"]);
  });

  it("ignores partial words, short entries and questions without a technology", () => {
    expect(termsIn("how did it go")).toEqual([]);
    expect(termsIn("postgresql")).toEqual([]);
    expect(termsIn("typescripting")).toEqual([]);
    expect(termsIn("hackathon wins")).toEqual([]);
    expect(termsIn("")).toEqual([]);
  });
});

describe("textHasTerm", () => {
  it("matches whole phrases only", () => {
    expect(textHasTerm("written in python 3 11 with sqlite", "python")).toBe(true);
    expect(textHasTerm("written in python 3 11 with sqlite", "sqlite")).toBe(true);
    expect(textHasTerm("uses typescript everywhere", "script")).toBe(false);
    expect(textHasTerm("", "python")).toBe(false);
  });
});
