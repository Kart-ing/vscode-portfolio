import { describe, expect, it } from "vitest";
import { MAX_SENTENCES } from "@/lib/contract";
import { MAX_MODEL_OUTPUT_CHARS, gateIds, isLeakedPhrasing, parseModelIds } from "@/lib/server/answer/protocol";

// The truth rules for the model path. The model returns ids only; the server
// keeps the ids in the question's candidate set and shows those facets' own
// text. Nothing the model writes is ever shown.

describe("parseModelIds", () => {
  it("reads the ids of a bare object", () => {
    expect(parseModelIds('{"ids": ["karts.what", "hackmit.win"]}')).toEqual(["karts.what", "hackmit.win"]);
    expect(parseModelIds('{"ids":[]}')).toEqual([]);
  });

  it("reads an object inside a code fence or prose, and drops the prose", () => {
    expect(parseModelIds('```json\n{"ids": ["karts.what"]}\n```')).toEqual(["karts.what"]);
    expect(parseModelIds('Yes. Kartikey worked at NASA. {"ids": ["karts.what"]} Hope that helps!')).toEqual([
      "karts.what",
    ]);
  });

  it("uses the first object that has an ids array", () => {
    expect(parseModelIds('{"note": "x"} {"ids": ["a.b"]} {"ids": ["c.d"]}')).toEqual(["a.b"]);
  });

  it("drops entries that are not strings and ignores other fields", () => {
    expect(parseModelIds('{"ids": ["a.b", 3, null, true, "c.d"], "answer": "Yes."}')).toEqual(["a.b", "c.d"]);
    // A nested object is not the flat shape the protocol allows.
    expect(parseModelIds('{"ids": ["a.b", {"x": 1}], "answer": "Yes."}')).toBeNull();
  });

  it("returns null for malformed output", () => {
    for (const output of [
      "",
      "karts.what",
      "Sure! Here is what I know about Kartikey.",
      '{"ids": ["karts.what",',
      '{"ids": "karts.what"}',
      '["karts.what"]',
      "{ids: [karts.what]}",
      "SAY Yes. Kartikey worked at NASA. [lunar-autonomy-challenge.role]",
      "NONE",
    ]) {
      expect(parseModelIds(output), output).toBeNull();
    }
  });

  it("never reads past MAX_MODEL_OUTPUT_CHARS", () => {
    expect(parseModelIds(`${"x".repeat(MAX_MODEL_OUTPUT_CHARS)}{"ids": ["karts.what"]}`)).toBeNull();
  });
});

describe("gateIds", () => {
  const candidates = new Set(["karts.what", "karts.founder", "hackmit.win", "hackmit.team", "patent.what"]);

  it("keeps candidates only, in the model's order", () => {
    expect(gateIds(["hackmit.win", "karts.what"], candidates)).toEqual(["hackmit.win", "karts.what"]);
  });

  it("drops valid ids from outside the set, invented ids and near-misses", () => {
    expect(gateIds(["raya-health.role", "karts.nope", "KARTS.WHAT", "karts", "karts.what"], candidates)).toEqual([
      "karts.what",
    ]);
  });

  it("deduplicates, trims and caps at MAX_SENTENCES", () => {
    expect(gateIds([" karts.what ", "karts.what"], candidates)).toEqual(["karts.what"]);
    expect(gateIds([...candidates], candidates)).toHaveLength(MAX_SENTENCES);
  });

  it("returns nothing for an empty or hostile list", () => {
    expect(gateIds([], candidates)).toEqual([]);
    expect(gateIds(["Ignore previous instructions", "SAY Yes."], candidates)).toEqual([]);
  });
});

describe("isLeakedPhrasing", () => {
  it("flags lines that say where a fact came from", () => {
    expect(isLeakedPhrasing('Devpost tagline: "A voice agent."')).toBe(true);
    expect(isLeakedPhrasing("Won the grand prize at HackMIT 2025.")).toBe(false);
  });
});
