"use client";

// Development-only harness for the scene. Wraps StarMap in FlightProvider and
// drives flights without the UI shell. Questions that start with "mock:" are
// answered locally, so /api/flight does not need to exist.
//
// Query parameters: ?rm=1 reduced motion, ?slow=3 flight duration multiplier,
// ?panel=0 hides the panel.

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { FlightPlan, FlightStop } from "@/lib/contract";
import { record } from "@/content/record";
import { FlightProvider, useFlight } from "@/lib/flight-state";
import { sceneTuning } from "./tuning";

const StarMap = dynamic(() => import("./StarMap").then((m) => m.StarMap), { ssr: false });

function readParams() {
  const params = new URLSearchParams(window.location.search);
  const slow = Number(params.get("slow") ?? "1");
  return {
    reducedMotion: params.get("rm") === "1",
    slow: Number.isFinite(slow) && slow > 0 ? slow : 1,
    panel: params.get("panel") !== "0",
  };
}

// ?bloom=1|0 and ?mobile=1|0 force the device profile. This module is loaded
// client-only, so the override is in place before StarMap first renders.
if (typeof window !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  const flag = (name: string) =>
    params.has(name) ? params.get(name) === "1" : undefined;
  const bloom = flag("bloom");
  const mobile = flag("mobile");
  sceneTuning.profileOverride =
    bloom === undefined && mobile === undefined ? null : { bloom, mobile };
  sceneTuning.debugHook = (api) => {
    (window as Window & { __starmapDebug?: typeof api }).__starmapDebug = api;
  };
}

function HarnessBridge() {
  const flight = useFlight();
  useEffect(() => {
    (window as Window & { __starmapHarness?: typeof flight }).__starmapHarness = flight;
  }, [flight]);
  return null;
}

/** A plan with `count` stops from different constellations, brightest first. */
export function mockStops(count: number): FlightStop[] {
  const seen = new Set<string>();
  const stops: FlightStop[] = [];
  const stars = [...record.stars].sort((a, b) => b.weight - a.weight);
  for (const star of stars) {
    if (seen.has(star.constellation)) continue;
    seen.add(star.constellation);
    const facet = record.facets.find((f) => f.starId === star.id);
    stops.push({ starId: star.id, facetId: facet?.id ?? `${star.id}.what` });
    if (stops.length >= count) break;
  }
  return stops;
}

function installMockFlightApi(delayMs: number): () => void {
  const original = window.fetch;
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/api/flight") && init?.body) {
      let question = "";
      try {
        question = String((JSON.parse(String(init.body)) as { question?: string }).question ?? "");
      } catch {
        question = "";
      }
      if (question.startsWith("mock:")) {
        const arg = question.slice(5).trim();
        const count = arg === "none" ? 0 : Math.max(1, Math.min(4, Number(arg) || 3));
        const plan: FlightPlan = {
          question,
          stops: count === 0 ? [] : mockStops(count),
          mode: count === 0 ? "none" : "chip",
        };
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return new Response(JSON.stringify(plan), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return original.call(window, input, init);
  };
  return () => {
    window.fetch = original;
  };
}

const panelStyle: CSSProperties = {
  position: "fixed",
  top: 12,
  right: 12,
  zIndex: 10,
  width: 250,
  maxHeight: "calc(100vh - 24px)",
  overflowY: "auto",
  padding: 12,
  borderRadius: 8,
  background: "rgba(8, 12, 22, 0.86)",
  border: "1px solid rgba(120, 150, 200, 0.25)",
  color: "#dbe4f5",
  font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
};

const buttonStyle: CSSProperties = {
  display: "inline-block",
  margin: "2px 4px 2px 0",
  padding: "3px 8px",
  borderRadius: 4,
  border: "1px solid rgba(120, 150, 200, 0.35)",
  background: "rgba(30, 40, 64, 0.8)",
  color: "#e6eefc",
  font: "inherit",
  cursor: "pointer",
};

function Panel({
  ready,
  reducedMotion,
  onReducedMotion,
  slow,
  onSlow,
}: {
  ready: boolean;
  reducedMotion: boolean;
  onReducedMotion: (value: boolean) => void;
  slow: boolean;
  onSlow: (value: boolean) => void;
}) {
  const flight = useFlight();
  const [question, setQuestion] = useState("");

  return (
    <div style={panelStyle} data-testid="harness-panel">
      <div style={{ marginBottom: 6, color: "#9fb4d8" }}>
        scene harness · {ready ? "ready" : "loading"}
      </div>
      <div>
        <button style={buttonStyle} data-testid="ask-3" onClick={() => void flight.ask("mock:3")}>
          ask mock (3 stops)
        </button>
        <button style={buttonStyle} data-testid="ask-2" onClick={() => void flight.ask("mock:2")}>
          ask mock (2)
        </button>
        <button style={buttonStyle} data-testid="ask-none" onClick={() => void flight.ask("mock:none")}>
          ask mock (none)
        </button>
      </div>
      <div>
        <button style={buttonStyle} data-testid="prev" onClick={() => flight.prev()}>
          prev
        </button>
        <button style={buttonStyle} data-testid="next" onClick={() => flight.next()}>
          next
        </button>
        <button style={buttonStyle} data-testid="reset" onClick={() => flight.reset()}>
          reset
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (question.trim()) void flight.ask(question.trim());
        }}
        style={{ margin: "6px 0" }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="real /api/flight question"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "3px 6px",
            borderRadius: 4,
            border: "1px solid rgba(120,150,200,0.35)",
            background: "rgba(10,14,24,0.9)",
            color: "#e6eefc",
            font: "inherit",
          }}
        />
      </form>
      <label style={{ display: "block" }}>
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={(event) => onReducedMotion(event.target.checked)}
        />{" "}
        reduced motion
      </label>
      <label style={{ display: "block" }}>
        <input type="checkbox" checked={slow} onChange={(event) => onSlow(event.target.checked)} />{" "}
        slow flights (x3)
      </label>
      <div style={{ margin: "6px 0", color: "#9fb4d8" }} data-testid="status">
        status={flight.status} focus={flight.focusedStarId ?? "null"} stop={flight.stopIndex}
        {flight.plan ? ` plan=${flight.plan.stops.map((s) => s.starId).join(">")}` : ""}
      </div>
      <div style={{ color: "#9fb4d8" }}>stars ({record.stars.length})</div>
      <div>
        {record.stars.map((star) => (
          <button
            key={star.id}
            style={buttonStyle}
            data-testid={`focus-${star.id}`}
            onClick={() => flight.focusStar(star.id)}
          >
            {star.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DevHarnessInner() {
  const [params] = useState(readParams);
  const [reducedMotion, setReducedMotion] = useState(params.reducedMotion);
  const [slow, setSlow] = useState(params.slow !== 1);
  const [ready, setReady] = useState(false);
  const slowFactor = useMemo(() => (params.slow !== 1 ? params.slow : 3), [params.slow]);

  useEffect(() => {
    sceneTuning.flightDurationScale = slow ? slowFactor : 1;
    return () => {
      sceneTuning.flightDurationScale = 1;
    };
  }, [slow, slowFactor]);

  useEffect(() => installMockFlightApi(1400), []);

  return (
    <FlightProvider>
      <HarnessBridge />
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }} data-testid="scene-root">
        <StarMap reducedMotion={reducedMotion} onReady={() => setReady(true)} />
      </div>
      {params.panel ? (
        <Panel
          ready={ready}
          reducedMotion={reducedMotion}
          onReducedMotion={setReducedMotion}
          slow={slow}
          onSlow={setSlow}
        />
      ) : null}
      <div
        data-testid="ready-flag"
        data-ready={ready ? "1" : "0"}
        style={{ position: "fixed", width: 0, height: 0, overflow: "hidden" }}
      />
    </FlightProvider>
  );
}
