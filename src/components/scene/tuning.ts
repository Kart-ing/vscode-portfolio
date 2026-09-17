// Scene tunables. Module scope so the dev harness can adjust them without
// widening the StarMap props contract. Read at flight start, never in render.

import type { StarMeta } from "@/lib/contract";
import type { SceneRuntime } from "./SceneContext";

/** Read-only probes the dev harness exposes for scripted checks. */
export interface SceneDebugApi {
  /** Screen position, in CSS pixels, of a star's centre; null if unknown. */
  project(starId: string): { x: number; y: number } | null;
  runtime(): SceneRuntime;
  /** Frames rendered since mount. */
  frames(): number;
  /** Intro phase and seconds elapsed, for scripted screenshots. */
  intro(): { phase: string; t: number };
  /** Kind of the staged view and how far the stars have travelled, 0..1. */
  view(): { kind: string | null; progress: number };
}

export interface ProfileOverride {
  mobile?: boolean;
  bloom?: boolean;
  dustCount?: number;
  nebulaOctaves?: number;
}

export const sceneTuning = {
  /** Multiplies every camera flight duration. The harness uses it to slow flights. */
  flightDurationScale: 1,
  /** Multiplies the intro length. The harness uses it to slow the warp for screenshots. */
  introDurationScale: 1,
  /** Forces parts of the detected device profile. Set before StarMap mounts. */
  profileOverride: null as ProfileOverride | null,
  /**
   * Dev-only: fills in start, stack and repo for stars that lack them, so the
   * timeline and stack views can be exercised before the record carries them.
   * Record values always win. Set before StarMap mounts.
   */
  metaOverride: null as Record<string, StarMeta> | null,
  /** Dev-only: receives the debug probes once the scene is running. */
  debugHook: null as ((api: SceneDebugApi) => void) | null,
  /** Extra distance factor applied to the computed overview radius. */
  overviewMargin: 0.86,
  /** Overview camera elevation above the disk plane, radians. */
  overviewElevation: 0.6,
  /** Stars closer than this to the camera show their label. */
  labelDistance: 16,
};

export const DISK_TILT = { x: -0.34, z: 0.16 };

/** Site accent, star-gold. */
export const ACCENT = "#f2c76b";
