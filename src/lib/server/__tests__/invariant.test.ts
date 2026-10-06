// Invariant I1 and the relevance gate, against the real record (the owner's
// one-story PRD of 6 Oct 2026, step A4). No network: fetch is always a mock,
// and the model's replies are scripted.
//
// For each probe the router's candidate set is pinned below. Every rendered
// sentence must belong to I1, every rendered facet id to the probe's pinned
// set, and every pinned set to what the PRD allows for that probe, or be
// empty where a no-answer is allowed. Five hostile model replies run on the
// NASA, full-time and HF0 probes. The NASA probes have no candidates since the
// lunar-challenge star was cut (owner's decision, 6 Oct 2026), so there the
// model must never be asked.

import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postAnswer } from "@/app/api/answer/route";
import { bannedIn } from "@/content/__tests__/scanner";
import { NO_ANSWER_TEXT, UI_ALLOWLIST } from "@/content/allowlist";
import { chips } from "@/content/chips";
import { record } from "@/content/record";
import { advocate, highlights, tour } from "@/content/scripts";
import type { AnswerEvent, AnswerSentence, FlightStop } from "@/lib/contract";
import { createAnswerer, type AnswererOptions } from "@/lib/server/answer/answerer";
import { MAX_CANDIDATES, answerCandidates } from "@/lib/server/answer/gate";
import { EXTRACT_RULES } from "@/lib/server/answer/prompt";
import { modelFetch, offeredIds, pickingFetch, stallingFetch, type FetchMock } from "./model-mock";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------- I1

const facetById = new Map(record.facets.map((f) => [f.id, f]));
const starOf = (facetId: string) => facetById.get(facetId)?.starId;

/** I1 (b): every sentence in scripts.ts and chips.ts. */
const CURATED: AnswerSentence[] = [
  ...advocate.sentences,
  ...highlights.sentences,
  ...tour.map((t) => t.sentence),
  ...chips.flatMap((c) => c.sentences ?? []),
];

const sameCitations = (a: readonly FlightStop[], b: readonly FlightStop[]) =>
  a.length === b.length && a.every((c, i) => c.starId === b[i].starId && c.facetId === b[i].facetId);

/** True when a rendered sentence is (a) a facet's own text citing it, or (b) a cited curated sentence, verbatim. */
function inI1(sentence: AnswerSentence): boolean {
  if (sentence.citations.length === 1) {
    const [cite] = sentence.citations;
    const facet = facetById.get(cite.facetId);
    if (facet && facet.starId === cite.starId && facet.text === sentence.text) return true;
  }
  return CURATED.some((c) => c.citations.length > 0 && c.text === sentence.text && sameCitations(c.citations, sentence.citations));
}

const says = (events: AnswerEvent[]) => events.flatMap((e) => (e.type === "say" ? [e.sentence] : []));
const renderedIds = (events: AnswerEvent[]) => says(events).flatMap((s) => s.citations.map((c) => c.facetId));
const doneMode = (events: AnswerEvent[]) => {
  const last = events[events.length - 1];
  return last?.type === "done" ? last.mode : undefined;
};

/** I1 and the banned-text scanner over one response. */
function expectI1(events: AnswerEvent[], where: string) {
  expect(doneMode(events), `${where}: ends with done`).toBeDefined();
  expect(events.filter((e) => e.type === "done"), `${where}: one done`).toHaveLength(1);
  for (const sentence of says(events)) {
    expect(inI1(sentence), `${where}: not in I1: "${sentence.text}"`).toBe(true);
    expect(UI_ALLOWLIST, `${where}: allowlist strings are never streamed`).not.toContain(sentence.text);
  }
  expect(bannedIn(JSON.stringify(events)), `${where}: banned text`).toEqual([]);
}

// ---------------------------------------------------------------- probes

interface Probe {
  question: string;
  /** What the PRD allows the pinned set to contain. */
  allows(facetId: string): boolean;
  noAnswerAllowed: boolean;
  /** The router's candidate ids, pinned: K = 12 at most, in the router's order. */
  pinned: string[];
}

const onStars = (...starIds: string[]) => (facetId: string) => starIds.includes(starOf(facetId) ?? "");
const BUILT_CHIP_FACETS = new Set(advocate.sentences.flatMap((s) => s.citations.map((c) => c.facetId)));

const PROBES: Probe[] = [
  // The PRD allows the lunar-challenge star or no answer. The star is cut, so
  // only no answer remains: no line in the record may stand in for NASA.
  {
    question: "Did Kartikey work at NASA?",
    allows: () => false,
    noAnswerAllowed: true,
    pinned: [],
  },
  {
    question: "Was he employed by NASA?",
    allows: () => false,
    noAnswerAllowed: true,
    pinned: [],
  },
  {
    question: "Has he worked for Intel?",
    allows: onStars("intel"),
    noAnswerAllowed: false,
    pinned: ["intel.role"],
  },
  {
    // "Snap funding facets": the accelerator's funding line, not the Snap AR prize.
    question: "Did he work with Snap?",
    allows: (id) => id === "snap-accelerator.funding",
    noAnswerAllowed: true,
    pinned: ["snap-accelerator.funding"],
  },
  {
    question: "Is he a YC founder?",
    allows: onStars("compiled-11"),
    noAnswerAllowed: true,
    pinned: [],
  },
  {
    question: "Was he in HF0?",
    allows: onStars("raya-health"),
    noAnswerAllowed: false,
    pinned: ["raya-health.role"],
  },
  {
    question: "Is Kartikey working on Karts full-time?",
    allows: onStars("karts", "cara"),
    noAnswerAllowed: false,
    pinned: ["karts.founder", "karts.what"],
  },
  {
    question: "Should we not hire him?",
    allows: (id) => BUILT_CHIP_FACETS.has(id),
    noAnswerAllowed: true,
    pinned: [],
  },
  {
    question: "Why shouldn't we invest in Karts?",
    allows: onStars("karts"),
    noAnswerAllowed: true,
    pinned: ["karts.what", "karts.founder", "karts.traction"],
  },
  { question: "What's his phone number?", allows: () => false, noAnswerAllowed: true, pinned: [] },
  { question: "Where does he live?", allows: () => false, noAnswerAllowed: true, pinned: [] },
];

const probe = (question: string) => PROBES.find((p) => p.question === question)!;

function answerer(overrides: Partial<AnswererOptions> = {}) {
  return createAnswerer({
    record,
    chips,
    advocate,
    highlights,
    getApiKey: () => undefined,
    timeoutMs: 200,
    cooldownMs: 0,
    log: () => {},
    ...overrides,
  });
}

async function run(question: string, overrides: Partial<AnswererOptions> = {}): Promise<AnswerEvent[]> {
  const events: AnswerEvent[] = [];
  for await (const event of answerer(overrides).answer(question, "probe")) events.push(event);
  return events;
}

/** The answer each probe gets with the model off: the router-only snapshot. */
const routerOnly = new Map<string, AnswerEvent[]>();
async function routerOnlyFor(question: string): Promise<AnswerEvent[]> {
  if (!routerOnly.has(question)) routerOnly.set(question, await run(question));
  return routerOnly.get(question)!;
}

describe("relevance gate: pinned candidate sets", () => {
  for (const p of PROBES) {
    it(`pins "${p.question}"`, () => {
      const ids = answerCandidates(p.question, record).candidates.map((c) => c.facetId);
      expect(ids).toEqual(p.pinned);
      expect(ids.length).toBeLessThanOrEqual(MAX_CANDIDATES);
    });

    it(`keeps "${p.question}" inside what the PRD allows`, () => {
      if (p.pinned.length === 0) expect(p.noAnswerAllowed, "an empty set must be an allowed no-answer").toBe(true);
      for (const id of p.pinned) expect(p.allows(id), id).toBe(true);
    });
  }

  it("draws the router's own answer from the candidates", () => {
    for (const p of PROBES) {
      const { candidates, answer } = answerCandidates(p.question, record);
      for (const stop of answer) expect(candidates, p.question).toContainEqual(stop);
    }
  });
});

describe("I1 on every probe, model off (the router-only snapshots)", () => {
  for (const p of PROBES) {
    it(`"${p.question}"`, async () => {
      const fetchSpy = vi.fn<typeof fetch>();
      const events = await run(p.question, { fetchImpl: fetchSpy });
      routerOnly.set(p.question, events);
      expectI1(events, p.question);
      for (const id of renderedIds(events)) expect(p.pinned, p.question).toContain(id);
      if (p.pinned.length === 0) {
        expect(events).toEqual([{ type: "done", mode: "none" }]);
      } else {
        expect(doneMode(events)).toBe("local");
        expect(says(events).length).toBeGreaterThan(0);
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }

  it("shows the allowlisted no-answer line, and only that, when nothing answers", () => {
    expect(UI_ALLOWLIST).toEqual([NO_ANSWER_TEXT]);
    expect(NO_ANSWER_TEXT).toBe("Nothing in the record answers that.");
  });
});

describe("I1 on every probe, with a well-behaved model", () => {
  for (const p of PROBES) {
    it(`"${p.question}"`, async () => {
      const fetchImpl = pickingFetch((offered) => [...offered].reverse());
      const events = await run(p.question, { getApiKey: () => "test-key", fetchImpl });
      expectI1(events, p.question);
      for (const id of renderedIds(events)) expect(p.pinned, p.question).toContain(id);
      if (p.pinned.length === 0) {
        expect(events).toEqual([{ type: "done", mode: "none" }]);
        expect(fetchImpl).not.toHaveBeenCalled();
        return;
      }
      // The model is only ever shown the pinned candidates.
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(offeredIds(fetchImpl.mock.calls[0][1])).toEqual(p.pinned);
      expect(doneMode(events)).toBe("model");
    });
  }
});

// ---------------------------------------------------------------- hostile mocks

const HOSTILE_PROBES = ["Did Kartikey work at NASA?", "Is Kartikey working on Karts full-time?", "Was he in HF0?"];

/** Valid record ids from outside each probe's candidate set. */
const OUTSIDE: Record<string, string[]> = {
  "Did Kartikey work at NASA?": ["raya-health.role", "intel.role", "karts.founder", "cara.role"],
  "Is Kartikey working on Karts full-time?": ["cara.role", "raya-health.role", "coldstart.role", "karts.traction"],
  "Was he in HF0?": ["coldstart.role", "karts.founder", "compiled-11.prize", "cara.role"],
};

/** A probe's first candidate, or an outside id when it has none (the model is never asked then). */
const firstId = (p: Probe) => p.pinned[0] ?? OUTSIDE[p.question][0];

interface Hostile {
  name: string;
  fetch(p: Probe): FetchMock;
  /** True when the gate must drop every id, so the answer is the router-only snapshot. */
  dropsAll: boolean;
}

const HOSTILE: Hostile[] = [
  {
    name: "valid ids from outside the candidate set",
    fetch: (p) => pickingFetch(() => OUTSIDE[p.question]),
    dropsAll: true,
  },
  {
    name: "ids plus prose",
    fetch: (p) =>
      modelFetch(
        `Yes. Kartikey worked at NASA and is full-time on Karts.\n{"ids": ${JSON.stringify([...p.pinned.slice(0, 1), ...OUTSIDE[p.question]])}}\nHe was in HF0, and Indian Patent 558662 makes him a patent holder.`,
      ),
    dropsAll: false,
  },
  {
    name: "invented ids",
    fetch: () =>
      pickingFetch(() => ["nasa.employment", "karts.full-time", "hf0.member", "lunar-autonomy-challenge.nasa", "Yes."]),
    dropsAll: true,
  },
  {
    name: "malformed JSON",
    fetch: (p) => modelFetch(`{"ids": [${JSON.stringify(firstId(p))}, "raya-health.role",`),
    dropsAll: true,
  },
  {
    name: "a timeout",
    fetch: (p) => stallingFetch(`{"ids": [${JSON.stringify(firstId(p))}`),
    dropsAll: true,
  },
];

describe("hostile model replies on the NASA, full-time and HF0 probes", () => {
  for (const question of HOSTILE_PROBES) {
    for (const hostile of HOSTILE) {
      it(`${hostile.name}: "${question}"`, async () => {
        const p = probe(question);
        const fetchImpl = hostile.fetch(p);
        const events = await run(question, { getApiKey: () => "test-key", fetchImpl, timeoutMs: 60 });
        expectI1(events, `${hostile.name} / ${question}`);
        // No id from outside the candidates is ever rendered.
        for (const id of renderedIds(events)) expect(p.pinned, id).toContain(id);
        for (const id of OUTSIDE[question]) expect(renderedIds(events), id).not.toContain(id);
        if (p.pinned.length === 0) {
          // No candidates: the model is never asked, and nothing is shown.
          expect(fetchImpl).not.toHaveBeenCalled();
          expect(events).toEqual([{ type: "done", mode: "none" }]);
        } else if (hostile.dropsAll) {
          expect(fetchImpl).toHaveBeenCalledTimes(1);
          expect(events).toEqual(await routerOnlyFor(question));
        } else {
          expect(fetchImpl).toHaveBeenCalledTimes(1);
          // Only the candidate survives; the prose around it never shows.
          expect(renderedIds(events)).toEqual([p.pinned[0]]);
          expect(doneMode(events)).toBe("model");
        }
      });
    }
  }
});

// ---------------------------------------------------------------- scripted paths and the real route

describe("I1 on the scripted paths", () => {
  const questions = [
    ...chips.map((c) => c.question),
    "Should we hire Kartikey?",
    "Should we invest in Karts?",
    "hi",
    "who is Kartikey",
  ];
  for (const question of questions) {
    it(`"${question}"`, async () => {
      const fetchImpl = modelFetch('{"ids": []}');
      const events = await run(question, { getApiKey: () => "test-key", fetchImpl });
      expectI1(events, question);
      expect(says(events).length).toBeGreaterThan(0);
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  }
});

async function postAnswerLines(question: string): Promise<AnswerEvent[]> {
  const res = await postAnswer(
    new Request("http://localhost/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
    }),
  );
  expect(res.status).toBe(200);
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AnswerEvent);
}

describe("I1 through the real POST /api/answer (no key, no network)", () => {
  it("answers every chip question and every probe within I1 and the pinned sets", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const question of chips.map((c) => c.question)) {
      const events = await postAnswerLines(question);
      expectI1(events, question);
      expect(doneMode(events)).toBe("chip");
    }
    for (const p of PROBES) {
      const events = await postAnswerLines(p.question);
      expectI1(events, p.question);
      for (const id of renderedIds(events)) expect(p.pinned, p.question).toContain(id);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- static checks

describe("I1 static checks", () => {
  it("the checker itself rejects text the model or a script could invent", () => {
    expect(inI1({ text: "Yes.", citations: [] })).toBe(false);
    expect(inI1({ text: "Kartikey worked at NASA.", citations: [{ starId: "intel", facetId: "intel.role" }] })).toBe(false);
    const raya = facetById.get("raya-health.role")!;
    expect(inI1({ text: raya.text, citations: [{ starId: "raya-health", facetId: "raya-health.role" }] })).toBe(true);
    expect(inI1({ text: raya.text, citations: [{ starId: "cara", facetId: "cara.role" }] })).toBe(false);
  });

  it("prompt rule 10 is gone: the model is never told to open with Yes or to advocate", () => {
    expect(EXTRACT_RULES).not.toMatch(/\byes\b/i);
    expect(EXTRACT_RULES).not.toMatch(/\b(?:hire|back|fund|invest|partner)\b/i);
    expect(EXTRACT_RULES).toContain('{"ids": ["<id>", ...]}');
    expect(EXTRACT_RULES).toContain("You never write an answer yourself");
  });

  it("the scanner fails on each banned phrase and on an age outside the approved spans", () => {
    for (const text of [
      "Yes.",
      "Kartikey is full-time on Karts.",
      "Kartikey worked at NASA.",
      "1st place",
      "a 12x winner",
      "a US patent",
      "a patent holder",
      "https://www.quickcompany.in/x",
      "https://iprsearch.ipindia.gov.in/",
      "https://patents.google.com/x",
    ]) {
      expect(bannedIn(text).length, text).toBeGreaterThan(0);
    }
    // The resume and LinkedIn may say this; on the site only C9 and N2 carry his age.
    expect(bannedIn("Kartikey filed my first patent at 16.").length).toBeGreaterThan(0);
  });
});
