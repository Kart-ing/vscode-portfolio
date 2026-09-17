"use client";

// Composition of everything inside the Canvas. The Choreographer goes first:
// it runs before every other frame callback and fills the runtime arrays the
// drawables read.

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer } from "@react-three/postprocessing";
import type { BloomEffect, ChromaticAberrationEffect } from "postprocessing";
import { Vector2, Vector3 } from "three";
import { Beams } from "./Beams";
import { CameraRig } from "./CameraRig";
import { Choreographer } from "./Choreographer";
import { FocusRing } from "./FocusRing";
import { Forms } from "./Forms";
import { Labels } from "./Labels";
import { Nebula } from "./Nebula";
import { PlanPath } from "./PlanPath";
import { PointField } from "./PointField";
import { Rings } from "./Rings";
import { useScene } from "./SceneContext";
import { useSignals } from "./signals";
import { Stars } from "./Stars";
import { sceneTuning } from "./tuning";
import { ViewStage } from "./ViewStage";
import { Warp } from "./Warp";

function Ready({ onReady }: { onReady?: () => void }) {
  const fired = useRef(false);
  useFrame(() => {
    if (fired.current) return;
    fired.current = true;
    // The callback runs before this frame renders; report after it has.
    if (onReady) requestAnimationFrame(() => onReady());
  });
  return null;
}

// Counts frames and hands the dev harness its probes. Inert in production,
// where nothing sets sceneTuning.debugHook.
function DebugBridge() {
  const { layout, runtimeRef } = useScene();
  const get = useThree((state) => state.get);
  const frames = useRef(0);
  const handed = useRef(false);
  useFrame(() => {
    frames.current += 1;
    if (handed.current || !sceneTuning.debugHook) return;
    handed.current = true;
    const scratch = new Vector3();
    sceneTuning.debugHook({
      project: (starId) => {
        const index = layout.indexById.get(starId);
        if (index === undefined) return null;
        const { camera, size } = get();
        const p = runtimeRef.current.positions;
        scratch.set(p[index * 3], p[index * 3 + 1], p[index * 3 + 2]).project(camera);
        return { x: (scratch.x * 0.5 + 0.5) * size.width, y: (0.5 - scratch.y * 0.5) * size.height };
      },
      runtime: () => ({ ...runtimeRef.current }),
      frames: () => frames.current,
      intro: () => ({ phase: runtimeRef.current.intro.phase, t: runtimeRef.current.intro.t }),
      view: () => ({ kind: runtimeRef.current.view.kind, progress: runtimeRef.current.view.progress }),
    });
  });
  return null;
}

// Bloom always; chromatic aberration only while the intro warps, and only on
// desktop. Both surge with the runtime: the warp, ignitions and beam locks.
function Effects() {
  const { runtimeRef, profile } = useScene();
  const { intro } = useSignals();
  const bloomRef = useRef<BloomEffect>(null);
  const aberrationRef = useRef<ChromaticAberrationEffect>(null);
  const offset = useMemo(() => new Vector2(0, 0), []);
  useFrame(() => {
    const rt = runtimeRef.current;
    const bloom = bloomRef.current;
    if (bloom) bloom.intensity = 0.85 + rt.intro.surge * 1.6 + rt.flash * 0.9;
    const aberration = aberrationRef.current;
    if (aberration) {
      const k = rt.intro.warp;
      aberration.offset.set(0.0034 * k, 0.0024 * k);
    }
  });
  const warp = intro === "playing" && !profile.mobile;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        ref={bloomRef}
        mipmapBlur
        intensity={0.85}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.35}
        radius={0.72}
        levels={7}
      />
      {warp ? (
        <ChromaticAberration
          ref={aberrationRef}
          offset={offset}
          radialModulation
          modulationOffset={0.4}
        />
      ) : null}
    </EffectComposer>
  );
}

export function Scene({ onReady }: { onReady?: () => void }) {
  const { profile } = useScene();
  return (
    <>
      <Choreographer />
      <Nebula />
      <PointField
        count={profile.mobile ? 700 : 1500}
        seed="far"
        distribution="shell"
        sizeRange={[0.9, 2.4]}
        scale={360}
        maxSize={2.4}
        opacity={0.75}
        colorA="#c9d6f2"
        colorB="#ffe3c4"
        animated={false}
      />
      <PointField
        count={profile.dustCount}
        seed="dust"
        distribution="disk"
        sizeRange={[1.0, 2.6]}
        scale={34}
        maxSize={4}
        opacity={0.85}
        colorA="#9db4e4"
        colorB="#f3dcc4"
        animated
      />
      <Warp />
      <Stars />
      <Forms />
      <Rings />
      <Beams />
      <ViewStage />
      <FocusRing />
      <PlanPath />
      <Labels />
      <CameraRig />
      {profile.bloom ? <Effects /> : null}
      <Ready onReady={onReady} />
      <DebugBridge />
    </>
  );
}
