"use client";

// The cinematic signature of kartikey.fyi: a flight through the work.
//
// Usage from the UI shell:
//   const StarMap = dynamic(() => import("@/components/scene/StarMap").then(m => m.StarMap), { ssr: false });
//   <div style={{ position: "fixed", inset: 0, zIndex: 0 }}><StarMap onReady={...} /></div>
//
// The component fills its container (100% x 100%), so the container must have
// a size. It must be rendered inside FlightProvider.

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
  type SceneRuntime,
} from "./SceneContext";

export interface StarMapProps {
  className?: string;
  /** Skip auto-orbit, drift and swirl; camera moves become quick fades. */
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
    return { mobile: false, bloom: false, dustCount: 1200, nebulaOctaves: 3 };
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
  --sm-ink: #edf0f7;
  --sm-accent: #f2c76b;
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
  transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
[data-starmap] .sm-stop-current {
  border-color: var(--sm-accent);
  background: var(--sm-accent);
  color: #070b16;
}
@keyframes sm-in {
  from { opacity: 0; transform: translate(-2px, -50%); }
  to { opacity: 1; transform: translate(4px, -50%); }
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
  const runtimeRef = useRef<SceneRuntime>(createRuntime());
  const layout = useMemo(() => buildLayout(record), []);
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
