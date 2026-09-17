"use client";

// Two hairline rings in the site accent around the focused star: one steady,
// one pulsing outward. Line2 keeps them about 1px wide on screen at any
// distance. They appear as the camera settles and follow the star's runtime
// position, so they stay on it inside staged views.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Group, Vector3 } from "three";
import { smoothstep } from "./motion";
import { useScene } from "./SceneContext";
import { ACCENT } from "./tuning";

const SEGMENTS = 96;

interface RingHandle {
  scale: Vector3;
  material: { opacity: number };
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
    const i = star.index;
    group.position.set(rt.positions[i * 3], rt.positions[i * 3 + 1], rt.positions[i * 3 + 2]);
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
