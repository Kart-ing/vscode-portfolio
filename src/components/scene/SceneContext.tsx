"use client";

import { createContext, useContext, type RefObject } from "react";
import { Vector3 } from "three";
import type { GeneratedView } from "@/lib/contract";
import type { StarLayout } from "./layout";

export interface DeviceProfile {
  /** Coarse pointer or small viewport. */
  mobile: boolean;
  /** Post-processing bloom is affordable. */
  bloom: boolean;
  dustCount: number;
  nebulaOctaves: number;
  /** Warp streaks during the intro. */
  streakCount: number;
}

export type ViewKind = GeneratedView["kind"];

export interface Pose {
  position: Vector3;
  target: Vector3;
}

export type IntroPhase = "idle" | "warp" | "ignite" | "settle" | "done";

export interface IntroRuntime {
  phase: IntroPhase;
  /** Seconds since the intro started. */
  t: number;
  /** Warp intensity, 0..1: streak length, aberration, camera rush. */
  warp: number;
  /** Eased 0..1 progress of the camera rush from the warp start to the overview. */
  travel: number;
  /** Extra bloom, 0..1. */
  surge: number;
  /** Year shown by the counter. */
  year: number;
  /** Counter opacity, 0..1. */
  yearAlpha: number;
  /** Stars lit so far, for the counter caption. */
  litCount: number;
  /** True for one frame when the intro was skipped, so the camera cuts. */
  skipped: boolean;
  /** Bumps whenever a new intro starts, so the camera restarts the warp. */
  run: number;
}

export interface BeamRuntime {
  /** Star index the beam reaches. */
  index: number;
  /** 0..1 opacity. */
  alpha: number;
  /** 0..1, solid gold once the sentence cited this star. */
  lock: number;
  /** 0..1, how far along the beam has raced from the camera. */
  reach: number;
  seed: number;
  age: number;
  /** Fading out; removed once alpha reaches 0. */
  dying: boolean;
}

export interface ViewRuntime {
  key: string;
  kind: ViewKind | null;
  /** 0..1 travel of the stars into (or out of) the staged arrangement. */
  progress: number;
  /** Camera pose that frames the stage; null in the free map. */
  pose: Pose | null;
  /** Bumps on every view change, so the camera re-frames. */
  run: number;
}

/**
 * Per-frame values shared between scene components. Mutated inside useFrame
 * callbacks only, never during render, so nothing here triggers React work.
 */
export interface SceneRuntime {
  /** Index of the focused star, or -1. */
  focusIndex: number;
  /** 0 in the overview, eases to 1 while a star is focused. */
  dim: number;
  /** True from flight start until landing. */
  flying: boolean;
  /** 0..1 progress of the current flight. */
  flightProgress: number;
  /** True once the camera has settled on the focused star. */
  landed: boolean;
  /** Dust swirl amount, 0..1. */
  swirl: number;
  // ---- V3
  /** Current star positions, xyz per star. Everything draws from these. */
  positions: Float32Array;
  /** Where each star is heading. Camera flights aim here. */
  targets: Float32Array;
  /** 0..1 ignition; 1 for every star once the intro is over. */
  lit: Float32Array;
  /** 0..1 timeline filter; 1 inside the year range or undated. */
  filter: Float32Array;
  /** 0..1 view emphasis; stars outside a staged view recede toward 0. */
  emphasis: Float32Array;
  /** 0..1 citation lock glow. */
  lock: Float32Array;
  /** Pulse strength, 0 for stars without recent pushes. */
  pulse: Float32Array;
  /** Seconds since ignition, or -1 before it. */
  ignite: Float32Array;
  /** True on frames where positions changed. */
  moving: boolean;
  intro: IntroRuntime;
  view: ViewRuntime;
  beams: BeamRuntime[];
  /** Where the beams start, in world space: just in front of the camera. */
  beamOrigin: Vector3;
  /** Extra bloom this frame from locks and ignitions, decays quickly. */
  flash: number;
  /** Star ids whose label a view asked to show. */
  labelIds: Set<string>;
  /** Where a staged view wants each star's label. */
  labelSides: Map<string, "right" | "left" | "above" | "below">;
  /** 0..1 opacity of the staged view's dressing: axis, panels, nodes, title. */
  stageAlpha: number;
  /** The tour is running: slower, wider camera arcs and a gentle orbit. */
  tour: boolean;
}

export interface SceneContextValue {
  layout: StarLayout;
  profile: DeviceProfile;
  reducedMotion: boolean;
  runtimeRef: RefObject<SceneRuntime>;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
}

export const SceneContext = createContext<SceneContextValue | null>(null);

export function useScene(): SceneContextValue {
  const value = useContext(SceneContext);
  if (!value) throw new Error("useScene must be used inside StarMap");
  return value;
}

export function createRuntime(layout: StarLayout): SceneRuntime {
  const n = layout.stars.length;
  const positions = new Float32Array(n * 3);
  layout.stars.forEach((star, i) => {
    positions[i * 3] = star.position.x;
    positions[i * 3 + 1] = star.position.y;
    positions[i * 3 + 2] = star.position.z;
  });
  return {
    focusIndex: -1,
    dim: 0,
    flying: false,
    flightProgress: 0,
    landed: false,
    swirl: 0,
    positions,
    targets: positions.slice(),
    lit: new Float32Array(n).fill(1),
    filter: new Float32Array(n).fill(1),
    emphasis: new Float32Array(n).fill(1),
    lock: new Float32Array(n),
    pulse: new Float32Array(n),
    ignite: new Float32Array(n).fill(-1),
    moving: false,
    intro: {
      phase: "idle",
      t: 0,
      warp: 0,
      travel: 1,
      surge: 0,
      year: 2020,
      yearAlpha: 0,
      litCount: 0,
      skipped: false,
      run: 0,
    },
    view: { key: "", kind: null, progress: 1, pose: null, run: 0 },
    beams: [],
    beamOrigin: new Vector3(),
    flash: 0,
    labelIds: new Set(),
    labelSides: new Map(),
    stageAlpha: 0,
    tour: false,
  };
}
