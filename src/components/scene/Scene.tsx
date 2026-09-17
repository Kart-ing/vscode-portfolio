"use client";

// Composition of everything inside the Canvas.

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Vector3 } from "three";
import { CameraRig } from "./CameraRig";
import { FocusRing } from "./FocusRing";
import { Labels } from "./Labels";
import { Nebula } from "./Nebula";
import { PlanPath } from "./PlanPath";
import { PointField } from "./PointField";
import { useScene } from "./SceneContext";
import { Stars } from "./Stars";
import { sceneTuning } from "./tuning";

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
        scratch.copy(layout.stars[index].position).project(camera);
        return { x: (scratch.x * 0.5 + 0.5) * size.width, y: (0.5 - scratch.y * 0.5) * size.height };
      },
      runtime: () => ({ ...runtimeRef.current }),
      frames: () => frames.current,
    });
  });
  return null;
}

function Effects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        mipmapBlur
        intensity={0.85}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.35}
        radius={0.72}
        levels={7}
      />
    </EffectComposer>
  );
}

export function Scene({ onReady }: { onReady?: () => void }) {
  const { profile } = useScene();
  return (
    <>
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
      <Stars />
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
