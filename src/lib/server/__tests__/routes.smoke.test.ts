// Wiring check against the real route modules and the real record. Content
// details are not asserted here; the record agent owns those.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlightPlan, WorkRecord } from "@/lib/contract";
import { chips } from "@/content/chips";
import { POST } from "@/app/api/flight/route";
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
