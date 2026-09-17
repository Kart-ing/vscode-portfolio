"use client";

// The cinematic signature of kartikey.fyi: a flight through the work.
//
// Usage from the UI shell:
//   const StarMap = dynamic(() => import("@/components/scene/StarMap").then(m => m.StarMap), { ssr: false });
//   <div style={{ position: "fixed", inset: 0, zIndex: 0 }}><StarMap onReady={...} /></div>
//
// The component fills its container (100% x 100%), so the container must have
// a size. It must be rendered inside FlightProvider. It reads the V3 signals
// (intro, beams, narration, view, yearRange, tour, pulses) from useFlight()
// and calls finishIntro() when the warp-in ends and focusStar() on clicks.

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Canvas, type RootState } from "@react-three/fiber";
import { record } from "@/content/record";
import { buildLayout } from "./layout";
import { Scene } from "./Scene";
import { sceneTuning } from "./tuning";
import {
  SceneContext,
  createRuntime,
  type DeviceProfile,
  type SceneContextValue,
} from "./SceneContext";

export interface StarMapProps {
  className?: string;
  /** Skip the intro, beams, drift and swirl; camera moves become quick fades. */
  reducedMotion?: boolean;
  /** Called once, after the first frame has rendered. */
  onReady?: () => void;
}

let webglSupport: boolean | null = null;

/**
 * True when this browser can create a WebGL context. Cached. Reports false
 * after a StarMap instance has failed to create its renderer.
 */
export function supportsWebGL(): boolean {
  if (typeof window === "undefined") return false;
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    webglSupport = Boolean(gl);
    if (gl && "getExtension" in gl) {
      const lose = (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context");
      lose?.loseContext();
    }
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

function markWebGLFailed() {
  webglSupport = false;
}

class SceneErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface NavigatorExtras {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

function detectProfile(): DeviceProfile {
  if (typeof window === "undefined") {
    return { mobile: false, bloom: false, dustCount: 1200, nebulaOctaves: 3, streakCount: 500 };
  }
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 560;
  const mobile = coarse || small;
  const extras = navigator as Navigator & NavigatorExtras;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = extras.deviceMemory ?? 8;
  const lowPower = cores <= 4 || memory <= 4 || Boolean(extras.connection?.saveData);
  const lowDpr = window.devicePixelRatio < 1;
  const override = sceneTuning.profileOverride ?? {};
  const effectiveMobile = override.mobile ?? mobile;
  return {
    mobile: effectiveMobile,
    bloom: override.bloom ?? (!effectiveMobile && !lowPower && !lowDpr),
    dustCount: override.dustCount ?? (effectiveMobile ? 1200 : 4000),
    nebulaOctaves: override.nebulaOctaves ?? (effectiveMobile ? 3 : 4),
    streakCount: effectiveMobile ? 500 : 1500,
  };
}

function detectReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const rootStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  isolation: "isolate",
  background: "#070B16",
};

const vignetteStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background:
    "radial-gradient(ellipse 80% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(4,6,14,0.6) 100%)",
};

const labelCss = `
[data-starmap] {
  --sm-mono: var(--font-mono, var(--font-dm-mono, ui-monospace, "SF Mono", Menlo, monospace));
  --sm-text: var(--font-text, var(--font-hanken, system-ui, -apple-system, "Segoe UI", sans-serif));
  --sm-ink: #edf0f7;
  --sm-accent: #f2c76b;
  --sm-stage: 0;
}
[data-starmap] .sm-constellation {
  font: 500 10.5px/1 var(--sm-mono);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(237, 240, 247, 0.55);
  opacity: calc(1 - 0.5 * var(--sm-dim, 0));
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  transition: opacity 0.4s ease;
  user-select: none;
}
[data-starmap] .sm-constellation.sm-muted {
  opacity: 0.04;
}
[data-starmap] .sm-constellation.sm-hidden {
  opacity: 0;
}
[data-starmap] .sm-star {
  display: block;
  transform: translate(4px, -50%);
  white-space: nowrap;
  animation: sm-in 0.28s ease-out both;
  user-select: none;
}
[data-starmap] .sm-star.sm-side-left {
  transform: translate(calc(-100% - 4px), -50%);
  text-align: right;
}
[data-starmap] .sm-star.sm-side-above {
  transform: translate(-50%, calc(-100% - 6px));
  text-align: center;
}
[data-starmap] .sm-star.sm-side-below {
  transform: translate(-50%, 6px);
  text-align: center;
}
[data-starmap] .sm-star-name {
  display: block;
  font: 500 11px/1.2 var(--sm-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--sm-ink);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95), 0 0 14px rgba(0, 0, 0, 0.7);
}
[data-starmap] .sm-star-period {
  display: block;
  margin-top: 4px;
  font: 400 9.5px/1 var(--sm-mono);
  letter-spacing: 0.1em;
  color: rgba(237, 240, 247, 0.55);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
}
[data-starmap] .sm-stop {
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(242, 199, 107, 0.45);
  background: rgba(7, 11, 22, 0.82);
  color: rgba(242, 199, 107, 0.85);
  font: 500 10px/1 var(--sm-mono);
  transform: translate(-100%, -50%) translate(-6px, 0);
  user-select: none;
  transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease, opacity 0.3s ease;
}
[data-starmap] .sm-stop-current {
  border-color: var(--sm-accent);
  background: var(--sm-accent);
  color: #070b16;
}
[data-starmap] .sm-stop-hidden {
  opacity: 0;
}
[data-starmap] .sm-year {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  user-select: none;
  white-space: nowrap;
}
[data-starmap] .sm-year-value {
  font: 500 64px/1 var(--sm-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.06em;
  color: var(--sm-accent);
  text-shadow: 0 0 28px rgba(242, 199, 107, 0.35), 0 2px 6px rgba(0, 0, 0, 0.8);
}
[data-starmap] .sm-year-caption {
  font: 400 10.5px/1 var(--sm-mono);
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: rgba(237, 240, 247, 0.6);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}
@media (max-width: 767px) {
  [data-starmap] .sm-year-value { font-size: 44px; }
}
[data-starmap] .sm-tick {
  display: block;
  font: 500 10px/1 var(--sm-mono);
  letter-spacing: 0.16em;
  color: rgba(242, 199, 107, 0.8);
  opacity: var(--sm-stage);
  transform: translateY(9px);
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  user-select: none;
}
[data-starmap] .sm-tick.sm-tick-vertical {
  transform: translate(calc(-50% - 4px), 0);
}
[data-starmap] .sm-title {
  display: block;
  font: 500 12px/1 var(--sm-mono);
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--sm-accent);
  opacity: var(--sm-stage);
  white-space: nowrap;
  text-shadow: 0 0 18px rgba(242, 199, 107, 0.3), 0 1px 2px rgba(0, 0, 0, 0.9);
  user-select: none;
}
[data-starmap] .sm-tech {
  display: block;
  font: 500 10px/1.1 var(--sm-mono);
  letter-spacing: 0.1em;
  color: rgba(237, 240, 247, 0.8);
  opacity: var(--sm-stage);
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95), 0 0 12px rgba(0, 0, 0, 0.7);
  transition: color 0.3s ease;
  user-select: none;
}
[data-starmap] .sm-tech-below { transform: translateY(13px); }
[data-starmap] .sm-tech-above { transform: translateY(-13px); }
[data-starmap] .sm-tech-right { transform: translateX(calc(50% + 10px)); }
[data-starmap] .sm-tech-left { transform: translateX(calc(-50% - 10px)); }
[data-starmap] .sm-tech-hot { color: var(--sm-accent); }
[data-starmap] .sm-panel {
  position: relative;
  width: 236px;
  padding: 12px 14px 13px;
  border-radius: 12px;
  background: rgba(10, 15, 28, 0.8);
  border: 1px solid rgba(237, 240, 247, 0.12);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  opacity: var(--sm-stage);
  color: var(--sm-ink);
  overflow: hidden;
  user-select: none;
}
[data-starmap] .sm-panel::before {
  content: "";
  position: absolute;
  left: 14px;
  right: 14px;
  top: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(242, 199, 107, 0.9), transparent);
}
[data-starmap] .sm-panel-below { translate: -50% 12px; }
[data-starmap] .sm-panel-right { translate: 12px -50%; }
[data-starmap] .sm-panel-compact { width: 224px; padding: 9px 12px 10px; }
[data-starmap] .sm-panel-compact .sm-panel-title { margin-top: 5px; font-size: 13.5px; }
[data-starmap] .sm-panel-compact .sm-panel-stack { margin-top: 6px; }
[data-starmap] .sm-panel-compact .sm-panel-fact {
  margin-top: 7px;
  font-size: 11.5px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
[data-starmap] .sm-panel-kind {
  font: 500 9.5px/1 var(--sm-mono);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(242, 199, 107, 0.85);
}
[data-starmap] .sm-panel-title {
  margin-top: 7px;
  font: 600 15px/1.2 var(--sm-text);
  letter-spacing: -0.01em;
  color: var(--sm-ink);
}
[data-starmap] .sm-panel-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
[data-starmap] .sm-badge {
  font: 500 9px/1 var(--sm-mono);
  letter-spacing: 0.08em;
  padding: 4px 6px;
  border-radius: 4px;
  background: rgba(237, 240, 247, 0.08);
  border: 1px solid rgba(237, 240, 247, 0.1);
  color: rgba(237, 240, 247, 0.82);
}
[data-starmap] .sm-panel-fact {
  margin: 9px 0 0;
  font: 400 12px/1.45 var(--sm-text);
  color: rgba(237, 240, 247, 0.78);
}
@keyframes sm-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

function onCanvasCreated(state: RootState) {
  const { gl } = state;
  gl.setClearColor("#070b16", 1);
  gl.domElement.style.transition = "opacity 160ms ease";
  gl.domElement.addEventListener("webglcontextlost", (event) => event.preventDefault());
}

export function StarMap({ className, reducedMotion, onReady }: StarMapProps) {
  const [supported] = useState(() => supportsWebGL());
  const [profile] = useState(detectProfile);
  const [systemReducedMotion] = useState(detectReducedMotion);
  const [hidden, setHidden] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const layout = useMemo(() => buildLayout(record, sceneTuning.metaOverride), []);
  const [runtime] = useState(() => createRuntime(layout));
  const runtimeRef = useRef(runtime);
  const motionReduced = reducedMotion ?? systemReducedMotion;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const contextValue = useMemo<SceneContextValue>(
    () => ({
      layout,
      profile,
      reducedMotion: motionReduced,
      runtimeRef,
      hoverId,
      setHoverId,
    }),
    [layout, profile, motionReduced, hoverId],
  );

  if (!supported || failed) return null;

  return (
    <div className={className} style={rootStyle} data-starmap="">
      <style>{labelCss}</style>
      <SceneContext.Provider value={contextValue}>
        <SceneErrorBoundary
          onError={() => {
            markWebGLFailed();
            setFailed(true);
          }}
        >
          <Canvas
            dpr={[1, 1.5]}
            frameloop={hidden ? "never" : "always"}
            flat
            gl={{
              antialias: false,
              alpha: false,
              stencil: false,
              depth: true,
              powerPreference: "high-performance",
              preserveDrawingBuffer: false,
            }}
            camera={{ fov: 50, near: 0.5, far: 1600, position: [-30, 44, 92] }}
            onCreated={onCanvasCreated}
            resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
            style={{ position: "absolute", inset: 0 }}
          >
            <Scene onReady={onReady} />
          </Canvas>
        </SceneErrorBoundary>
      </SceneContext.Provider>
      <div aria-hidden style={vignetteStyle} />
    </div>
  );
}
