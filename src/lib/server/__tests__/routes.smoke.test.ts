// Wiring check against the real route modules and the real record. Content
// details are not asserted here; the record agent owns those.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnswerEvent, FlightPlan, WorkRecord } from "@/lib/contract";
import { chips } from "@/content/chips";
import { POST } from "@/app/api/flight/route";
import { POST as postAnswer } from "@/app/api/answer/route";
import { GET as getPulse } from "@/app/api/pulse/route";
import { GET as getRecordJson } from "@/app/record.json/route";
import { GET as getLlmsTxt } from "@/app/llms.txt/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("real routes", () => {
  it("POST /api/flight answers a chip question without the network", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await POST(
      new Request("http://localhost/api/flight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: chips[0].question }),
      }),
    );
    expect(res.status).toBe(200);
    const plan = (await res.json()) as FlightPlan;
    expect(plan.mode).toBe("chip");
    expect(plan.stops).toEqual(chips[0].stops);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST /api/flight returns the empty plan for garbage", async () => {
    const res = await POST(new Request("http://localhost/api/flight", { method: "POST", body: "nope" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ question: "", stops: [], mode: "none" });
  });

  it("GET /record.json serves the record with a public cache header", async () => {
    const res = getRecordJson();
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=3600");
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as WorkRecord;
    expect(typeof body.owner.name).toBe("string");
    expect(Array.isArray(body.stars)).toBe(true);
    expect(Array.isArray(body.facets)).toBe(true);
  });

  it("GET /llms.txt serves markdown with a public cache header", async () => {
    const res = getLlmsTxt();
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=3600");
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const text = await res.text();
    expect(text.startsWith("# ")).toBe(true);
    expect(text).toContain("https://www.kartikey.fyi/record.json");
  });
});

async function answerLines(body: string): Promise<AnswerEvent[]> {
  const res = await postAnswer(
    new Request("http://localhost/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("application/x-ndjson");
  expect(res.headers.get("cache-control")).toBe("no-store");
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AnswerEvent);
}

describe("real V3 routes", () => {
  it("POST /api/answer answers 'Should we hire him?' from the script with no network", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const events = await answerLines(JSON.stringify({ question: "Should we hire him?" }));
    expect(events[events.length - 1]).toEqual({ type: "done", mode: "advocate" });
    const says = events.flatMap((e) => (e.type === "say" ? [e.sentence] : []));
    expect(says.length).toBeGreaterThanOrEqual(1);
    expect(says[0].text).toBe("Yes.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST /api/answer returns only done:none for a private question", async () => {
    expect(await answerLines(JSON.stringify({ question: "what is your date of birth" }))).toEqual([
      { type: "done", mode: "none" },
    ]);
  });

  it("POST /api/answer narrates a greeting from the highlights", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const events = await answerLines(JSON.stringify({ question: "hi" }));
    expect(events[events.length - 1]).toEqual({ type: "done", mode: "local" });
    expect(events.some((e) => e.type === "say")).toBe(true);
    expect(events.some((e) => e.type === "beams")).toBe(false);
  });

  it("POST /api/answer narrates a typed question locally without a key, beams first", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const events = await answerLines(JSON.stringify({ question: "What has Kartikey built with Python?" }));
    expect(events[0].type).toBe("beams");
    expect(events.filter((e) => e.type === "say").length).toBeGreaterThanOrEqual(1);
    expect(events[events.length - 1]).toEqual({ type: "done", mode: "local" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST /api/answer never 500s on garbage", async () => {
    const events = await answerLines("nope");
    expect(events[events.length - 1]).toEqual({ type: "done", mode: "none" });
  });

  it("GET /api/pulse returns [] with a public cache header when GitHub is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const res = await getPulse();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=900");
    expect(await res.json()).toEqual([]);
  });
});
