import { describe, expect, it } from "vitest";
import { MAX_SENTENCES, type GeneratedView } from "@/lib/contract";
import {
  MAX_SENTENCE_CHARS,
  ProtocolValidator,
  buildTruthIndex,
  clipSentence,
  numberTokens,
  parseProtocolLine,
  relevantView,
  validateSay,
  validateView,
} from "@/lib/server/answer/protocol";
import { fixtureRecord } from "./fixture";

const index = buildTruthIndex(fixtureRecord);
const say = (body: string) => validateSay(body, index);
const view = (body: string) => validateView(body, index);

describe("numberTokens", () => {
  it("normalizes every kind of figure the record uses", () => {
    expect(numberTokens("12x $1,000 #185 97% 2026. 1.5B 3.5% 1,482 Qwen2.5-1.5B 100,000+ 2022–2026 June 20-21, 3rd")).toEqual([
      "12", "1000", "185", "97", "2026", "1.5", "3.5", "1482", "2.5", "1.5", "100000", "2022", "2026", "20", "21", "3",
    ]);
    expect(numberTokens("no digits here")).toEqual([]);
  });
});

describe("validateSay (truth rules 2 and 3)", () => {
  it("drops an uncited sentence", () => {
    expect(say("Kartikey founded Karts.")).toBeNull();
  });

  it("drops a sentence whose only citation is unknown", () => {
    expect(say("Kartikey founded Karts. [karts.nope]")).toBeNull();
    expect(say("Kartikey founded Karts. [1]")).toBeNull();
  });

  it("keeps the known citations and drops the unknown ones", () => {
    expect(say("Kartikey founded Karts. [karts.nope] [karts.what]")).toEqual({
      text: "Kartikey founded Karts.",
      citations: [{ starId: "karts", facetId: "karts.what" }],
    });
  });

  it("reads several ids in one bracket and deduplicates", () => {
    expect(say("Kartikey built Karts and won HackMIT. [karts.what, hackmit.win] [karts.what]")?.citations).toEqual([
      { starId: "karts", facetId: "karts.what" },
      { starId: "hackmit", facetId: "hackmit.win" },
    ]);
  });

  it("drops a sentence with a number that no cited facet carries", () => {
    expect(say("Kartikey won 3 hackathons. [hackmit.win]")).toBeNull();
    expect(say("Kartikey raised $100 in sponsorships. [robotics-club.growth]")).toBeNull();
    expect(say("Karts shipped in 2025. [karts.since]")).toBeNull();
  });

  it("keeps sentences whose numbers all appear in a cited facet", () => {
    for (const body of [
      "Kartikey won HackMIT 2025 in 24 hours. [hackmit.win]",
      "Kartikey grew the club 12x and raised $1,000, lifting its rank from #185 to #74. [robotics-club.growth]",
      "Kartikey hit 97% accuracy on 1,000+ specs and cut 3 days to 2. [acme.impact]",
      "Kartikey ran a 1.5B model at 3.5% of the tokens. [hackmit.team]",
      "Karts has shipped weekly since 2026. [karts.since]",
      // Formatting differences vanish after digit normalization.
      "Kartikey raised $1000 for the club. [robotics-club.growth]",
      "Kartikey handled 1000 specs a day. [acme.impact]",
    ]) {
      expect(say(body), body).not.toBeNull();
    }
  });

  it("lets a second citation vouch for a number", () => {
    expect(say("Kartikey built Karts and won HackMIT 2025. [karts.what] [hackmit.win]")?.text).toBe(
      "Kartikey built Karts and won HackMIT 2025.",
    );
    expect(say("Kartikey built Karts and won HackMIT 2025. [karts.what]")).toBeNull();
  });

  it("strips markers, trims whitespace and tidies punctuation", () => {
    expect(say("  Kartikey   founded Karts . [karts.what]  ")?.text).toBe("Kartikey founded Karts.");
    expect(say("[karts.what] Kartikey founded Karts.")?.text).toBe("Kartikey founded Karts.");
  });

  it("accepts a bare facet id as a citation and removes it from the text", () => {
    expect(say("Kartikey founded Karts. karts.what")).toEqual({
      text: "Kartikey founded Karts.",
      citations: [{ starId: "karts", facetId: "karts.what" }],
    });
    expect(say("Kartikey founded Karts (karts.what).")?.citations).toEqual([{ starId: "karts", facetId: "karts.what" }]);
  });

  it("drops a sentence that is only a citation", () => {
    expect(say("[karts.what]")).toBeNull();
    expect(say("   ")).toBeNull();
  });

  it("caps the displayed text at 280 characters on a word boundary", () => {
    const long = `Kartikey ${"builds things ".repeat(40)}[karts.what]`;
    const sentence = say(long);
    expect(sentence).not.toBeNull();
    expect(sentence!.text.length).toBeLessThanOrEqual(MAX_SENTENCE_CHARS);
    expect(sentence!.text.endsWith("…")).toBe(true);
    expect(sentence!.text).not.toContain("  ");
    expect(clipSentence("a".repeat(300))).toHaveLength(MAX_SENTENCE_CHARS);
    expect(clipSentence("short")).toBe("short");
  });
});

describe("validateView", () => {
  it("accepts timeline and stack with two or more valid star ids", () => {
    expect(view("timeline karts hackmit")).toEqual({ kind: "timeline", starIds: ["karts", "hackmit"] });
    expect(view("stack karts multiverse acme")).toEqual({ kind: "stack", starIds: ["karts", "multiverse", "acme"] });
    expect(view("Timeline, karts, hackmit")).toEqual({ kind: "timeline", starIds: ["karts", "hackmit"] });
  });

  it("drops timeline and stack with fewer than two valid ids", () => {
    expect(view("timeline karts")).toBeNull();
    expect(view("timeline karts nope")).toBeNull();
    expect(view("stack")).toBeNull();
  });

  it("keeps two or three stars for compare and trims a longer list", () => {
    expect(view("compare karts hackmit")).toEqual({ kind: "compare", starIds: ["karts", "hackmit"] });
    expect(view("compare karts hackmit multiverse patent")).toEqual({
      kind: "compare",
      starIds: ["karts", "hackmit", "multiverse"],
    });
    expect(view("compare karts")).toBeNull();
  });

  it("resolves facet ids to their stars and deduplicates", () => {
    expect(view("stack karts.what multiverse.stack karts")).toEqual({ kind: "stack", starIds: ["karts", "multiverse"] });
  });

  it("accepts a known constellation and drops an unknown one", () => {
    expect(view("constellation research")).toEqual({ kind: "constellation", constellation: "research" });
    expect(view("constellation [research]")).toEqual({ kind: "constellation", constellation: "research" });
    expect(view("constellation nope")).toBeNull();
    expect(view("constellation")).toBeNull();
  });

  it("drops unknown kinds and empty bodies", () => {
    expect(view("orbit karts hackmit")).toBeNull();
    expect(view("")).toBeNull();
    expect(view("karts hackmit")).toBeNull();
  });
});

describe("parseProtocolLine", () => {
  it("recognizes the keywords with list markers, bold and colons", () => {
    expect(parseProtocolLine("SAY hi [a.b]")).toEqual({ kind: "say", body: "hi [a.b]" });
    expect(parseProtocolLine("say: hi")).toEqual({ kind: "say", body: "hi" });
    expect(parseProtocolLine("- SAY hi")).toEqual({ kind: "say", body: "hi" });
    expect(parseProtocolLine("1. SAY hi")).toEqual({ kind: "say", body: "hi" });
    expect(parseProtocolLine("**SAY** hi")).toEqual({ kind: "say", body: "hi" });
    expect(parseProtocolLine("VIEW timeline a b")).toEqual({ kind: "view", body: "timeline a b" });
    expect(parseProtocolLine("END")).toEqual({ kind: "end" });
    expect(parseProtocolLine("END.")).toEqual({ kind: "end" });
    expect(parseProtocolLine("  end ")).toEqual({ kind: "end" });
  });

  it("treats every line without a keyword as other, even a cited one", () => {
    expect(parseProtocolLine("Kartikey founded Karts. [karts.what]")).toEqual({
      kind: "other",
      body: "Kartikey founded Karts. [karts.what]",
    });
    expect(parseProtocolLine("I should SAY something about [karts.what] first.")).toEqual({
      kind: "other",
      body: "I should SAY something about [karts.what] first.",
    });
    expect(parseProtocolLine("Sure, here you go:")).toEqual({ kind: "other", body: "Sure, here you go:" });
    expect(parseProtocolLine("SAYING hello")).toEqual({ kind: "other", body: "SAYING hello" });
    expect(parseProtocolLine("ENDS here")).toEqual({ kind: "other", body: "ENDS here" });
    expect(parseProtocolLine("")).toEqual({ kind: "other", body: "" });
  });
});

describe("ProtocolValidator", () => {
  const valid = (n: number) => `SAY Kartikey line ${n === 0 ? "" : ""}built Karts. [karts.what]`;

  it("emits a view then sentences, and stops at END", () => {
    const validator = new ProtocolValidator(index);
    expect(validator.accept("VIEW compare karts hackmit")).toEqual([
      { type: "view", view: { kind: "compare", starIds: ["karts", "hackmit"] } },
    ]);
    expect(validator.accept("SAY Kartikey founded Karts. [karts.what]")).toEqual([
      { type: "say", sentence: { text: "Kartikey founded Karts.", citations: [{ starId: "karts", facetId: "karts.what" }] } },
    ]);
    expect(validator.done).toBe(false);
    expect(validator.accept("END")).toEqual([]);
    expect(validator.done).toBe(true);
    expect(validator.accept("SAY Kartikey won HackMIT. [hackmit.win]")).toEqual([]);
    expect(validator.sentenceCount).toBe(1);
  });

  it("stops after MAX_SENTENCES valid sentences and ignores invalid lines", () => {
    const validator = new ProtocolValidator(index);
    const emitted = [];
    for (let i = 0; i < MAX_SENTENCES + 2; i += 1) {
      emitted.push(...validator.accept("SAY Kartikey has 99 problems."), ...validator.accept(valid(i)));
    }
    expect(emitted).toHaveLength(MAX_SENTENCES);
    expect(validator.done).toBe(true);
  });

  it("keeps only the first valid view", () => {
    const validator = new ProtocolValidator(index);
    expect(validator.accept("VIEW orbit karts hackmit")).toEqual([]);
    expect(validator.accept("VIEW timeline karts hackmit")).toHaveLength(1);
    expect(validator.accept("VIEW compare karts hackmit")).toEqual([]);
  });

  it("never throws on odd input", () => {
    const validator = new ProtocolValidator(index);
    for (const line of ["", "   ", "```", "[", "]]]", "SAY", "VIEW", " ", "SAY [", "SAY ] [karts.what"]) {
      expect(() => validator.accept(line)).not.toThrow();
    }
  });
});

describe("relevance guard (a named technology)", () => {
  const typescript = { stackTerms: ["typescript"] };

  it("keeps a sentence whose cited star declares the technology in its stack", () => {
    expect(validateSay("Kartikey built Karts in TypeScript. [karts.what]", index, typescript)).not.toBeNull();
  });

  it("keeps a sentence whose cited facet text names the technology", () => {
    expect(validateSay("Kartikey built the club site. [robotics-club.site]", index, typescript)).not.toBeNull();
  });

  it("drops a sentence whose citations carry neither", () => {
    expect(validateSay("Kartikey built Multiverse, a branch predictor for tool calls. [multiverse.what]", index, typescript)).toBeNull();
    expect(validateSay("Kartikey won HackMIT 2025. [hackmit.win]", index, typescript)).toBeNull();
    expect(validateSay("Kartikey wrote the club site in TypeScript. [hackmit.win]", index, typescript)).toBeNull();
  });

  it("keeps a sentence when any one citation is relevant, and any one term matches", () => {
    expect(validateSay("Kartikey built Karts and Multiverse. [multiverse.what] [karts.what]", index, typescript)).not.toBeNull();
    expect(validateSay("Kartikey built Multiverse. [multiverse.what]", index, { stackTerms: ["typescript", "sqlite"] })).not.toBeNull();
  });

  it("does not filter when the question names no technology", () => {
    for (const options of [{}, { stackTerms: [] }, undefined]) {
      expect(validateSay("Kartikey built Multiverse. [multiverse.what]", index, options)).not.toBeNull();
    }
  });

  it("applies through the validator", () => {
    const validator = new ProtocolValidator(index, typescript);
    expect(validator.accept("SAY Kartikey built Multiverse. [multiverse.what]")).toEqual([]);
    expect(validator.accept("SAY Kartikey built Karts in TypeScript. [karts.what]")).toHaveLength(1);
  });
});

describe("leaked phrasing", () => {
  it("drops sentences that mention Devpost or a tagline", () => {
    expect(validateSay("Kartikey's Devpost tagline says it books tables. [hackmit.tagline]", index)).toBeNull();
    expect(validateSay("The tagline: a voice agent that books tables. [hackmit.win]", index)).toBeNull();
    expect(validateSay("Kartikey built SignEase with a Devpost tagline about banking. [hackmit.win]", index)).toBeNull();
    expect(validateSay("Kartikey listed it on DEVPOST. [hackmit.win]", index)).toBeNull();
  });

  it("keeps a sentence that states what the work is, even from a tagline facet", () => {
    expect(validateSay("Kartikey built a voice agent that books restaurant tables by phone. [hackmit.tagline]", index)).toEqual({
      text: "Kartikey built a voice agent that books restaurant tables by phone.",
      citations: [{ starId: "hackmit", facetId: "hackmit.tagline" }],
    });
  });

  it("turns a trailing comma or semicolon before the citation into a full stop", () => {
    expect(validateSay("Kartikey built Karts, [karts.what]", index)?.text).toBe("Kartikey built Karts.");
    expect(validateSay("Kartikey built Karts; [karts.what]", index)?.text).toBe("Kartikey built Karts.");
    expect(validateSay("Kartikey built Karts! [karts.what]", index)?.text).toBe("Kartikey built Karts!");
  });
});

describe("relevantView (a named technology)", () => {
  const typescript = ["typescript"];

  it("keeps only stars whose stack or facets carry the technology", () => {
    expect(relevantView({ kind: "stack", starIds: ["karts", "multiverse", "robotics-club", "hackmit"] }, typescript, index)).toEqual({
      kind: "stack",
      starIds: ["karts", "robotics-club"],
    });
    expect(relevantView({ kind: "timeline", starIds: ["robotics-club", "karts"] }, typescript, index)).toEqual({
      kind: "timeline",
      starIds: ["robotics-club", "karts"],
    });
  });

  it("drops a view left with fewer than two relevant stars", () => {
    expect(relevantView({ kind: "compare", starIds: ["karts", "multiverse"] }, typescript, index)).toBeNull();
    expect(relevantView({ kind: "stack", starIds: ["multiverse", "hackmit"] }, typescript, index)).toBeNull();
  });

  it("leaves constellation views and untargeted questions alone", () => {
    const constellation: GeneratedView = { kind: "constellation", constellation: "research" };
    expect(relevantView(constellation, typescript, index)).toEqual(constellation);
    const stack: GeneratedView = { kind: "stack", starIds: ["multiverse", "hackmit"] };
    expect(relevantView(stack, [], index)).toEqual(stack);
    expect(relevantView(stack, undefined, index)).toEqual(stack);
  });

  it("applies through the validator", () => {
    const validator = new ProtocolValidator(index, { stackTerms: typescript });
    expect(validator.accept("VIEW compare karts multiverse")).toEqual([]);
    expect(validator.accept("VIEW stack karts multiverse robotics-club")).toEqual([
      { type: "view", view: { kind: "stack", starIds: ["karts", "robotics-club"] } },
    ]);
  });
});
