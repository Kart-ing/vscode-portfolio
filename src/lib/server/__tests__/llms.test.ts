import { describe, expect, it } from "vitest";
import { renderLlmsTxt } from "@/lib/server/llms";
import { buildSystemPrompt } from "@/lib/server/flight/prompt";
import { fixtureRecord } from "./fixture";

describe("renderLlmsTxt", () => {
  const text = renderLlmsTxt(fixtureRecord, "https://www.kartikey.fyi");

  it("starts with the name, role and tagline", () => {
    expect(text.startsWith("# Test Owner\n\nFounder, Karts\n\n> Karts is the IDE")).toBe(true);
    expect(text).toContain("[GitHub](https://github.com/example)");
  });

  it("has one section per constellation with stars, periods, summaries, facets and links", () => {
    for (const c of fixtureRecord.constellations) expect(text).toContain(`\n## ${c.label}\n`);
    expect(text).toContain("### Karts (2026)");
    expect(text).toContain("### HackMIT 2025 (Sep 2025)");
    expect(text).toContain("\nKarts is the IDE and coding servers for startups.\n");
    expect(text).toContain("- Won the grand prize at HackMIT 2025 with a voice agent built in 24 hours.");
    expect(text).toContain("([Patent record](https://example.com/patent))");
    expect(text).toContain("- Links: [Devpost](https://devpost.com/example)");
  });

  it("points at record.json and states the provenance", () => {
    expect(text).toContain("https://www.kartikey.fyi/record.json");
    expect(text).toMatch(/every claim .* owner's verified record/i);
  });

  it("keeps stars in constellation order", () => {
    expect(text.indexOf("## Building")).toBeLessThan(text.indexOf("## Research"));
    expect(text.indexOf("## Research")).toBeLessThan(text.indexOf("## Education"));
  });
});

describe("buildSystemPrompt", () => {
  it("lists one line per facet and is byte-stable", () => {
    const prompt = buildSystemPrompt(fixtureRecord);
    for (const facet of fixtureRecord.facets) {
      const star = fixtureRecord.stars.find((s) => s.id === facet.starId);
      expect(prompt).toContain(`\n${facet.id} | ${star?.label} | ${facet.text}\n`);
    }
    expect(prompt).toContain("reply with exactly: NONE");
    expect(buildSystemPrompt(fixtureRecord)).toBe(prompt);
  });
});
