"use client";

// Development-only harness for the scene. Wraps StarMap in FlightProvider and
// drives it without the UI shell. Questions that start with "mock:" are
// answered by a local NDJSON stream, so /api/answer does not need a key. The
// V3 signals (intro, beams, narration, views, year range, pulses, tour) can
// also be driven directly through SignalsOverride; a signal is only shadowed
// once the harness has set it, so a mock answer still plays through the real
// provider.
//
// Query parameters:
//   ?rm=1            reduced motion
//   ?slow=3          flight duration multiplier
//   ?introslow=2     intro duration multiplier
//   ?panel=0         hides the panel
//   ?bloom=1|0       force post-processing
//   ?mobile=1|0      force the mobile profile
//   ?fakemeta=0      do not fill in demo start/stack/repo data
//   ?intro=1         start with the intro playing
//   ?view=timeline|compare|stack|constellation
//   ?beams=1         thinking beams (status asking); ?lock=1 also locks citations
//   ?years=2024-2026 year range
//   ?pulses=1        fake repo pulses
//   ?tour=1          tour mode
//   ?focus=<starId>  focus a star on load
//   ?narration=1     demo narration (cited stars) without beams
//   ?ui=1            draw stand-ins for the shell's overlays (title, narration, card, dock, sheet)
//
// Mock questions: "mock:3" (3 stops), "mock:none", "mock:timeline",
// "mock:compare", "mock:stack", "mock:constellation" (3 stops plus a view).

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type {
  AnswerEvent,
  AnswerSentence,
  FlightPlan,
  FlightStop,
  GeneratedView,
  RepoPulse,
  StarMeta,
} from "@/lib/contract";
import { record } from "@/content/record";
import {
  FlightProvider,
  useFlight,
  type FlightStatus,
  type IntroPhase,
  type TourState,
} from "@/lib/flight-state";
import { SignalsOverride, useSignals, type FlightSignals } from "./signals";
import { sceneTuning } from "./tuning";

const StarMap = dynamic(() => import("./StarMap").then((m) => m.StarMap), { ssr: false });

type ViewKind = GeneratedView["kind"];
const VIEW_KINDS: ViewKind[] = ["timeline", "compare", "stack", "constellation"];

interface Params {
  reducedMotion: boolean;
  slow: number;
  panel: boolean;
  intro: boolean;
  view: ViewKind | null;
  beams: boolean;
  lock: boolean;
  narration: boolean;
  years: [number, number] | null;
  pulses: boolean;
  tour: boolean;
  focus: string | null;
  ui: boolean;
}

function readParams(): Params {
  const params = new URLSearchParams(window.location.search);
  const slow = Number(params.get("slow") ?? "1");
  const view = params.get("view") as ViewKind | null;
  const years = /^(\d{4})-(\d{4})$/.exec(params.get("years") ?? "");
  return {
    reducedMotion: params.get("rm") === "1",
    slow: Number.isFinite(slow) && slow > 0 ? slow : 1,
    panel: params.get("panel") !== "0",
    intro: params.get("intro") === "1",
    view: view && VIEW_KINDS.includes(view) ? view : null,
    beams: params.get("beams") === "1" || params.get("lock") === "1",
    lock: params.get("lock") === "1",
    narration: params.get("narration") === "1",
    years: years ? [Number(years[1]), Number(years[2])] : null,
    pulses: params.get("pulses") === "1",
    tour: params.get("tour") === "1",
    focus: params.get("focus"),
    ui: params.get("ui") === "1",
  };
}

// Demo metadata for stars that lack start, stack or repo, so the timeline and
// stack views can be exercised before the record carries them. Record values
// always win (see resolveMeta).
const FAKE_META: Record<string, StarMeta> = {
  karts: { stack: ["TypeScript", "Go", "React", "Next.js", "Postgres", "WebSockets"], repo: "Kart-ing/karts" },
  multiverse: { stack: ["Python", "Docker", "gVisor", "asyncio"], repo: "Kart-ing/multiverse" },
  pingpal: { stack: ["TypeScript", "Node.js", "MCP", "npm"], repo: "Kart-ing/pingpal" },
  "hermes-offloader": { stack: ["Python", "systemd", "Claude Code", "DeepSeek"], repo: "Kart-ing/hermes-offloader" },
  recompress: { stack: ["Python", "PyTorch", "Transformers"], repo: "Kart-ing/ReCompress" },
  acrn: { stack: ["Next.js", "TypeScript", "Tailwind"], repo: "Kart-ing/acrn" },
  "token-company-prd": { stack: ["Markdown", "Claude Code"], repo: "Kart-ing/token-company-prd" },
  "berkeley-ai-hackathon-2026": { stack: ["Python", "PyTorch"], repo: "Kart-ing/ReCompress" },
  "calhacks-12": { stack: ["TypeScript", "Next.js", "LLM"], repo: "Kart-ing/agentoverflow" },
};

// ?bloom=1|0 and ?mobile=1|0 force the device profile; ?fakemeta=0 disables the
// demo metadata. This module is loaded client-only, so the overrides are in
// place before StarMap first renders.
if (typeof window !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  const flag = (name: string) =>
    params.has(name) ? params.get(name) === "1" : undefined;
  const bloom = flag("bloom");
  const mobile = flag("mobile");
  sceneTuning.profileOverride =
    bloom === undefined && mobile === undefined ? null : { bloom, mobile };
  sceneTuning.metaOverride = params.get("fakemeta") === "0" ? null : FAKE_META;
  const introSlow = Number(params.get("introslow") ?? "1");
  sceneTuning.introDurationScale = Number.isFinite(introSlow) && introSlow > 0 ? introSlow : 1;
  sceneTuning.debugHook = (api) => {
    (window as Window & { __starmapDebug?: typeof api }).__starmapDebug = api;
  };
}

const DEMO_VIEWS: Record<ViewKind, GeneratedView> = {
  timeline: {
    kind: "timeline",
    starIds: [
      "intel",
      "patent",
      "hackharvard-2023",
      "hackpsu-fall-2024",
      "coldstart",
      "calhacks-12",
      "recompress",
      "karts",
    ],
  },
  compare: { kind: "compare", starIds: ["karts", "multiverse", "recompress"] },
  stack: { kind: "stack", starIds: ["multiverse", "pingpal", "hermes-offloader", "karts"] },
  constellation: { kind: "constellation", constellation: "hackathons" },
};

const DEMO_BEAMS = ["karts", "multiverse", "recompress", "calhacks-12", "pingpal"];

const DEMO_NARRATION: AnswerSentence[] = [
  {
    text: "Kartikey is building Karts, the IDE and coding servers for startups.",
    citations: [{ starId: "karts", facetId: "karts.what" }],
  },
  {
    text: "Multiverse is a speculative execution harness for AI agents.",
    citations: [{ starId: "multiverse", facetId: "multiverse.what" }],
  },
];

function fakePulses(): Record<string, RepoPulse> {
  const now = Date.now();
  const day = 86400000;
  const make = (starId: string, repo: string, daysAgo: number, pushes: number, stars: number): RepoPulse => ({
    starId,
    repo,
    stars,
    lastPushAt: new Date(now - daysAgo * day).toISOString(),
    pushesLast30d: pushes,
  });
  return {
    multiverse: make("multiverse", "Kart-ing/multiverse", 1, 9, 12),
    pingpal: make("pingpal", "Kart-ing/pingpal", 9, 3, 5),
    "hermes-offloader": make("hermes-offloader", "Kart-ing/hermes-offloader", 21, 1, 2),
    karts: make("karts", "Kart-ing/karts", 4, 14, 3),
  };
}

function tourState(active: boolean): TourState {
  return { active, index: 0, paused: false, total: active ? 1 : 0 };
}

interface Overrides {
  intro: IntroPhase;
  beams: string[];
  narration: AnswerSentence[];
  view: GeneratedView | null;
  yearRange: [number, number];
  pulses: Record<string, RepoPulse>;
  tour: TourState;
  status: FlightStatus | null;
  /** Signals the harness has set; only these shadow the provider. */
  touched: Set<string>;
}

function initialOverrides(params: Params): Overrides {
  const touched = new Set<string>(["intro"]);
  if (params.beams) touched.add("beams").add("status");
  if (params.lock || params.narration) touched.add("narration");
  if (params.view) touched.add("view");
  if (params.years) touched.add("yearRange");
  if (params.pulses) touched.add("pulses");
  if (params.tour) touched.add("tour");
  return {
    intro: params.intro ? "playing" : "done",
    beams: params.beams ? DEMO_BEAMS : [],
    narration: params.lock || params.narration ? DEMO_NARRATION : [],
    view: params.view ? DEMO_VIEWS[params.view] : null,
    yearRange: params.years ?? [2020, 2026],
    pulses: params.pulses ? fakePulses() : {},
    tour: tourState(params.tour),
    status: params.beams ? "asking" : null,
    touched,
  };
}

interface HarnessControls {
  setIntro(phase: IntroPhase): void;
  setBeams(ids: string[]): void;
  setNarration(sentences: AnswerSentence[]): void;
  setView(view: GeneratedView | null): void;
  setYearRange(range: [number, number]): void;
  setPulses(pulses: Record<string, RepoPulse>): void;
  setTour(active: boolean): void;
  setStatus(status: FlightStatus | null): void;
  /** Stop shadowing these signals; the provider's own values show again. */
  release(keys: string[]): void;
}

type HarnessApi = FlightSignals & { controls: HarnessControls };

function HarnessBridge({ controls }: { controls: HarnessControls }) {
  const signals = useSignals();
  useEffect(() => {
    (window as Window & { __starmapHarness?: HarnessApi }).__starmapHarness = {
      ...signals,
      controls,
    };
  }, [signals, controls]);
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

function mockQuestion(init: RequestInit | undefined): string | null {
  if (!init?.body) return null;
  try {
    const question = String((JSON.parse(String(init.body)) as { question?: string }).question ?? "");
    return question.startsWith("mock:") ? question.slice(5).trim() : null;
  } catch {
    return null;
  }
}

/** The events a mock answer streams: beams, an optional view, one cited line per stop, done. */
function mockEvents(arg: string): AnswerEvent[] {
  if (arg === "none") return [{ type: "done", mode: "none" }];
  const viewKind = VIEW_KINDS.find((kind) => kind === arg);
  const count = viewKind ? 3 : Math.max(1, Math.min(4, Number(arg) || 3));
  const stops = mockStops(count);
  const beams = [...new Set([...stops.map((s) => s.starId), ...DEMO_BEAMS])].slice(0, 6);
  const events: AnswerEvent[] = [{ type: "beams", starIds: beams }];
  if (viewKind) events.push({ type: "view", view: DEMO_VIEWS[viewKind] });
  for (const stop of stops) {
    const facet = record.facets.find((f) => f.id === stop.facetId);
    events.push({ type: "say", sentence: { text: facet?.text ?? stop.facetId, citations: [stop] } });
  }
  events.push({ type: "done", mode: "local" });
  return events;
}

/**
 * Answers "mock:" questions locally. /api/answer streams NDJSON with the
 * real timing (beams at once, sentences 900ms apart); /api/flight, kept for
 * the V2 provider, returns a plan.
 */
function installMockApi(delayMs: number): () => void {
  const original = window.fetch;
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const arg = url.endsWith("/api/answer") || url.endsWith("/api/flight") ? mockQuestion(init) : null;
    if (arg === null) return original.call(window, input, init);
    if (url.endsWith("/api/flight")) {
      const count = arg === "none" ? 0 : Math.max(1, Math.min(4, Number(arg) || 3));
      const plan: FlightPlan = {
        question: `mock:${arg}`,
        stops: count === 0 ? [] : mockStops(count),
        mode: count === 0 ? "none" : "chip",
      };
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return new Response(JSON.stringify(plan), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const events = mockEvents(arg);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let firstSentence = true;
        for (const event of events) {
          let wait = 200;
          if (event.type === "beams") wait = 60;
          else if (event.type === "say") {
            wait = firstSentence ? delayMs : 900;
            firstSentence = false;
          } else if (event.type === "view") wait = 120;
          await new Promise((resolve) => setTimeout(resolve, wait));
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { "content-type": "application/x-ndjson" },
    });
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
  width: 260,
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

const activeButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "rgba(242, 199, 107, 0.85)",
  color: "#070b16",
  borderColor: "rgba(242, 199, 107, 0.9)",
};

const headingStyle: CSSProperties = { margin: "8px 0 2px", color: "#9fb4d8" };

function Panel({
  ready,
  reducedMotion,
  onReducedMotion,
  slow,
  onSlow,
  controls,
  overrides,
}: {
  ready: boolean;
  reducedMotion: boolean;
  onReducedMotion: (value: boolean) => void;
  slow: boolean;
  onSlow: (value: boolean) => void;
  controls: HarnessControls;
  overrides: Overrides;
}) {
  const flight = useFlight();
  const signals = useSignals();
  const [question, setQuestion] = useState("");
  const beamsOn = overrides.touched.has("beams") && overrides.beams.length > 0;
  const lockOn = overrides.touched.has("narration") && overrides.narration.length > 0;

  return (
    <div style={panelStyle} data-testid="harness-panel">
      <div style={{ marginBottom: 6, color: "#9fb4d8" }}>
        scene harness · {ready ? "ready" : "loading"}
      </div>

      <div style={headingStyle}>intro</div>
      <div>
        <button
          style={overrides.intro === "playing" ? activeButtonStyle : buttonStyle}
          data-testid="intro-play"
          onClick={() => controls.setIntro("playing")}
        >
          play intro
        </button>
        <button style={buttonStyle} data-testid="intro-skip" onClick={() => controls.setIntro("done")}>
          skip
        </button>
        <span style={{ color: "#9fb4d8" }}> {overrides.intro}</span>
      </div>

      <div style={headingStyle}>thinking beams</div>
      <div>
        <button
          style={beamsOn && !lockOn ? activeButtonStyle : buttonStyle}
          data-testid="beams-demo"
          onClick={() => {
            controls.setNarration([]);
            controls.setBeams(DEMO_BEAMS);
            controls.setStatus("asking");
          }}
        >
          beams
        </button>
        <button
          style={lockOn ? activeButtonStyle : buttonStyle}
          data-testid="beams-lock"
          onClick={() => {
            if (!beamsOn) {
              controls.setBeams(DEMO_BEAMS);
              controls.setStatus("asking");
            }
            controls.setNarration(DEMO_NARRATION);
          }}
        >
          lock citations
        </button>
        <button
          style={buttonStyle}
          data-testid="beams-land"
          onClick={() => {
            controls.setStatus(null);
            flight.focusStar(DEMO_NARRATION[0].citations[0].starId);
          }}
        >
          land
        </button>
        <button
          style={buttonStyle}
          data-testid="beams-clear"
          onClick={() => controls.release(["beams", "narration", "status"])}
        >
          clear
        </button>
      </div>

      <div style={headingStyle}>views</div>
      <div>
        {VIEW_KINDS.map((kind) => (
          <button
            key={kind}
            style={
              overrides.touched.has("view") && overrides.view?.kind === kind
                ? activeButtonStyle
                : buttonStyle
            }
            data-testid={`view-${kind}`}
            onClick={() => controls.setView(DEMO_VIEWS[kind])}
          >
            {kind}
          </button>
        ))}
        <button
          style={overrides.touched.has("view") && overrides.view === null ? activeButtonStyle : buttonStyle}
          data-testid="view-none"
          onClick={() => controls.setView(null)}
        >
          free map
        </button>
      </div>

      <div style={headingStyle}>
        years · {overrides.yearRange[0]}–{overrides.yearRange[1]}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="range"
          min={2020}
          max={2026}
          value={overrides.yearRange[0]}
          data-testid="years-from"
          onChange={(event) => {
            const from = Number(event.target.value);
            controls.setYearRange([from, Math.max(from, overrides.yearRange[1])]);
          }}
          style={{ flex: 1 }}
        />
        <input
          type="range"
          min={2020}
          max={2026}
          value={overrides.yearRange[1]}
          data-testid="years-to"
          onChange={(event) => {
            const to = Number(event.target.value);
            controls.setYearRange([Math.min(to, overrides.yearRange[0]), to]);
          }}
          style={{ flex: 1 }}
        />
      </div>

      <div style={headingStyle}>live</div>
      <div>
        <button
          style={Object.keys(overrides.pulses).length ? activeButtonStyle : buttonStyle}
          data-testid="pulses-toggle"
          onClick={() =>
            controls.setPulses(Object.keys(overrides.pulses).length ? {} : fakePulses())
          }
        >
          fake pulses
        </button>
        <button
          style={overrides.tour.active ? activeButtonStyle : buttonStyle}
          data-testid="tour-toggle"
          onClick={() => controls.setTour(!overrides.tour.active)}
        >
          tour {overrides.tour.active ? "on" : "off"}
        </button>
      </div>

      <div style={headingStyle}>answers (mock /api/answer)</div>
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
        {VIEW_KINDS.map((kind) => (
          <button
            key={kind}
            style={buttonStyle}
            data-testid={`ask-${kind}`}
            onClick={() => void flight.ask(`mock:${kind}`)}
          >
            ask + {kind}
          </button>
        ))}
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
          placeholder="real /api/answer question"
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
        status={signals.status} focus={signals.focusedStarId ?? "null"} stop={signals.stopIndex}
        {signals.beams.length ? ` beams=${signals.beams.length}` : ""}
        {signals.narration.length ? ` said=${signals.narration.length}` : ""}
        {signals.view ? ` view=${signals.view.kind}` : ""}
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

const overlayStyle: CSSProperties = {
  position: "fixed",
  zIndex: 10,
  pointerEvents: "none",
  boxSizing: "border-box",
  padding: 8,
  background: "rgba(9, 13, 24, 0.84)",
  border: "1px dashed rgba(242, 199, 107, 0.35)",
  color: "rgba(242, 199, 107, 0.7)",
  font: "11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
};

// ?ui=1: translucent stand-ins for the shell's overlays, with the geometry
// the scene's label exclusion assumes (see underShell in Labels.tsx), so a
// screenshot shows exactly what would sit under them.
function ShellOverlay() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const narrow = size.w / Math.max(size.h, 1) < 0.9;
  if (narrow) {
    return (
      <>
        <div style={{ ...overlayStyle, left: 0, top: 0, width: "100%", height: "24%" }}>title</div>
        <div style={{ ...overlayStyle, left: 0, top: "47%", width: "100%", height: "53%" }}>sheet</div>
      </>
    );
  }
  return (
    <>
      <div style={{ ...overlayStyle, left: 0, top: 0, width: "36%", height: 110 }}>masthead</div>
      <div style={{ ...overlayStyle, left: 0, top: 110, width: "36%", height: "calc(100% - 280px)" }}>
        narration column
      </div>
      <div style={{ ...overlayStyle, right: 0, top: 100, width: 440, height: 670 }}>card</div>
      <div style={{ ...overlayStyle, left: 0, bottom: 0, width: "100%", height: 170 }}>
        prompt · chips · footer
      </div>
    </>
  );
}

function FocusOnLoad({ starId }: { starId: string | null }) {
  const { focusStar } = useFlight();
  useEffect(() => {
    if (!starId) return;
    const timer = window.setTimeout(() => focusStar(starId), 50);
    return () => window.clearTimeout(timer);
    // Only on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function DevHarnessInner() {
  const [params] = useState(readParams);
  const [reducedMotion, setReducedMotion] = useState(params.reducedMotion);
  const [slow, setSlow] = useState(params.slow !== 1);
  const [ready, setReady] = useState(false);
  const [overrides, setOverrides] = useState<Overrides>(() => initialOverrides(params));
  const slowFactor = useMemo(() => (params.slow !== 1 ? params.slow : 3), [params.slow]);

  useEffect(() => {
    sceneTuning.flightDurationScale = slow ? slowFactor : 1;
    return () => {
      sceneTuning.flightDurationScale = 1;
    };
  }, [slow, slowFactor]);

  useEffect(() => installMockApi(1400), []);

  const patch = useCallback((next: Partial<Omit<Overrides, "touched">>) => {
    setOverrides((current) => ({
      ...current,
      ...next,
      touched: new Set([...current.touched, ...Object.keys(next)]),
    }));
  }, []);

  const controls = useMemo<HarnessControls>(
    () => ({
      setIntro: (intro) => patch({ intro }),
      setBeams: (beams) => patch({ beams }),
      setNarration: (narration) => patch({ narration }),
      setView: (view) => patch({ view }),
      setYearRange: (yearRange) => patch({ yearRange }),
      setPulses: (pulses) => patch({ pulses }),
      setTour: (active) => patch({ tour: tourState(active) }),
      setStatus: (status) => patch({ status }),
      release: (keys) =>
        setOverrides((current) => {
          const touched = new Set(current.touched);
          for (const key of keys) touched.delete(key);
          return { ...current, touched };
        }),
    }),
    [patch],
  );

  const value = useMemo<Partial<FlightSignals>>(() => {
    const has = (key: string) => overrides.touched.has(key);
    const base: Partial<FlightSignals> = {
      intro: overrides.intro,
      finishIntro: () => patch({ intro: "done" }),
      setYearRange: (range) => patch({ yearRange: range }),
      startTour: () => patch({ tour: tourState(true) }),
      stopTour: () => patch({ tour: tourState(false) }),
    };
    if (has("beams")) base.beams = overrides.beams;
    if (has("narration")) base.narration = overrides.narration;
    if (has("view")) base.view = overrides.view;
    if (has("yearRange")) base.yearRange = overrides.yearRange;
    if (has("pulses")) base.pulses = overrides.pulses;
    if (has("tour")) base.tour = overrides.tour;
    if (has("status") && overrides.status) base.status = overrides.status;
    return base;
  }, [overrides, patch]);

  return (
    <FlightProvider>
      <SignalsOverride value={value}>
        <HarnessBridge controls={controls} />
        <FocusOnLoad starId={params.focus} />
        {params.ui ? <ShellOverlay /> : null}
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
            controls={controls}
            overrides={overrides}
          />
        ) : null}
        <div
          data-testid="ready-flag"
          data-ready={ready ? "1" : "0"}
          data-intro={overrides.intro}
          style={{ position: "fixed", width: 0, height: 0, overflow: "hidden" }}
        />
      </SignalsOverride>
    </FlightProvider>
  );
}
