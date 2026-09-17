"use client";

// Two hairline rings in the site accent around the focused star: one steady,
// one pulsing outward. Line2 keeps them about 1px wide on screen at any
// distance. They appear as the camera settles.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Group, Vector3 } from "three";
import { useScene } from "./SceneContext";

const ACCENT = "#f2c76b";
const SEGMENTS = 96;

interface RingHandle {
  scale: Vector3;
  material: { opacity: number };
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function FocusRing() {
  const { layout, runtimeRef, reducedMotion, profile } = useScene();
  const groupRef = useRef<Group>(null);
  const steadyRef = useRef<RingHandle>(null);
  const pulseRef = useRef<RingHandle>(null);

  const circle = useMemo(() => {
    const points: [number, number, number][] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      points.push([Math.cos(a), Math.sin(a), 0]);
    }
    return points;
  }, []);

  useFrame((state) => {
    const group = groupRef.current;
    const steady = steadyRef.current;
    const pulse = pulseRef.current;
    if (!group || !steady || !pulse) return;
    const rt = runtimeRef.current;
    const star = rt.focusIndex >= 0 ? layout.stars[rt.focusIndex] : null;
    if (!star) {
      group.visible = false;
      return;
    }
    group.visible = true;
    group.position.copy(star.position);
    group.quaternion.copy(state.camera.quaternion);
    const appear = rt.flying ? smoothstep(0.6, 1, rt.flightProgress) : 1;
    // Visible halo radius of the glow quad, including the focus boost.
    const halo = star.size * (profile.mobile ? 1.3 : 1) * 1.2 * 0.72;
    const t = state.clock.elapsedTime;

    const breathe = reducedMotion ? 0 : Math.sin(t * 1.6);
    steady.scale.setScalar(halo * (1.45 + 0.03 * breathe));
    steady.material.opacity = (0.42 + 0.08 * breathe) * appear;

    if (reducedMotion) {
      pulse.scale.setScalar(halo * 2.2);
      pulse.material.opacity = 0.14 * appear;
      return;
    }
    const phase = (t * 0.32) % 1;
    pulse.scale.setScalar(halo * (1.45 + phase * 0.95));
    pulse.material.opacity = Math.pow(1 - phase, 1.8) * 0.3 * appear;
  });

  return (
    <group ref={groupRef} visible={false} renderOrder={6}>
      <Line
        ref={steadyRef as never}
        points={circle}
        color={ACCENT}
        lineWidth={1.1}
        transparent
        opacity={0}
        depthWrite={false}
      />
      <Line
        ref={pulseRef as never}
        points={circle}
        color={ACCENT}
        lineWidth={1}
        transparent
        opacity={0}
        depthWrite={false}
      />
    </group>
  );
}
