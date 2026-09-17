"use client";

import { createContext, useContext, type RefObject } from "react";
import type { StarLayout } from "./layout";

export interface DeviceProfile {
  /** Coarse pointer or small viewport. */
  mobile: boolean;
  /** Post-processing bloom is affordable. */
  bloom: boolean;
  dustCount: number;
  nebulaOctaves: number;
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

export function createRuntime(): SceneRuntime {
  return {
    focusIndex: -1,
    dim: 0,
    flying: false,
    flightProgress: 0,
    landed: false,
    swirl: 0,
  };
}
