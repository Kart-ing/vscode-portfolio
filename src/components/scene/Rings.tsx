"use client";

// One instanced draw of camera-facing ring quads, one per star. During the
// intro each ring is the shockwave of that star's ignition; afterwards it is
// the soft periodic pulse of a repo pushed in the last 30 days, brightest for
// the most recent push.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import { easeOutCubic } from "./motion";
import { ringFragment, ringVertex } from "./shaders";
import { useScene } from "./SceneContext";
import { ACCENT } from "./tuning";

const PULSE_PERIOD = 2.8;

export function Rings() {
  const { layout, runtimeRef, reducedMotion, profile } = useScene();
  const meshRef = useRef<InstancedMesh>(null);
  const matrix = useMemo(() => new Matrix4(), []);

  const mesh = useMemo(() => {
    const n = Math.max(layout.stars.length, 1);
    const geometry = new PlaneGeometry(2, 2);
    const ring = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
    ring.setUsage(DynamicDrawUsage);
    const colors = new Float32Array(n * 3);
    layout.stars.forEach((star, i) => {
      colors[i * 3] = star.color.r;
      colors[i * 3 + 1] = star.color.g;
      colors[i * 3 + 2] = star.color.b;
    });
    geometry.setAttribute("aRing", ring);
    geometry.setAttribute("aColor", new InstancedBufferAttribute(colors, 3));
    const material = new ShaderMaterial({
      vertexShader: ringVertex,
      fragmentShader: ringFragment,
      uniforms: { uGold: { value: new Color(ACCENT) } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    const instanced = new InstancedMesh(geometry, material, n);
    instanced.count = layout.stars.length;
    instanced.instanceMatrix.setUsage(DynamicDrawUsage);
    instanced.frustumCulled = false;
    instanced.renderOrder = 7;
    return instanced;
  }, [layout]);

  useEffect(() => {
    const mounted = meshRef.current;
    return () => {
      if (!mounted) return;
      mounted.geometry.dispose();
      (mounted.material as ShaderMaterial).dispose();
    };
  }, []);

  useFrame((state) => {
    const instanced = meshRef.current;
    if (!instanced) return;
    const rt = runtimeRef.current;
    const t = state.clock.elapsedTime;
    const attribute = instanced.geometry.getAttribute("aRing") as InstancedBufferAttribute;
    const arr = attribute.array as Float32Array;
    const p = rt.positions;
    const sizeScale = profile.mobile ? 1.3 : 1;
    let any = false;
    for (let i = 0; i < layout.stars.length; i++) {
      const star = layout.stars[i];
      const age = rt.ignite[i];
      let radius = 0;
      let alpha = 0;
      let width = 0.08;
      let gold = 0.7;
      if (age >= 0 && age < 1.0 && !reducedMotion) {
        const k = age / 1.0;
        radius = star.size * sizeScale * (0.8 + 2.2 * easeOutCubic(k));
        alpha = Math.pow(1 - k, 1.7) * 0.75 * rt.lit[i];
        width = 0.08 + 0.02 * k;
        gold = 0.55;
      } else if (rt.pulse[i] > 0) {
        const vis = rt.lit[i] * rt.filter[i] * (0.3 + 0.7 * rt.emphasis[i]);
        // Soft and close to the star, whatever its weight.
        const base = Math.min(star.size, 1.5) * sizeScale;
        if (reducedMotion) {
          radius = base * 1.7;
          alpha = 0.12 * rt.pulse[i] * vis;
          width = 0.07;
          gold = 0.85;
        } else {
          const phase = ((t + star.seed * 7) / PULSE_PERIOD) % 1;
          radius = base * (1.05 + 1.4 * easeOutCubic(phase));
          alpha = Math.pow(1 - phase, 2.0) * 0.34 * rt.pulse[i] * vis;
          width = 0.07 + 0.02 * phase;
          gold = 0.85;
        }
      }
      if (alpha > 0.002) any = true;
      arr[i * 4] = radius;
      arr[i * 4 + 1] = alpha;
      arr[i * 4 + 2] = width;
      arr[i * 4 + 3] = gold;
      matrix.makeTranslation(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      instanced.setMatrixAt(i, matrix);
    }
    attribute.needsUpdate = true;
    instanced.instanceMatrix.needsUpdate = true;
    instanced.visible = any;
  });

  return <primitive object={mesh} ref={meshRef} />;
}
