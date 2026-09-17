"use client";

// Thinking beams: camera-facing ribbons of light from just in front of the
// camera to each candidate star while a question is being answered. Dashes
// race along them; once a sentence cites a star its beam locks solid gold and
// the others fade. One instanced draw for every beam.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import { beamFragment, beamVertex } from "./shaders";
import { useScene } from "./SceneContext";
import { ACCENT } from "./tuning";

const SEGMENTS = 56;
const MAX_BEAMS = 8;

export function Beams() {
  const { runtimeRef, profile } = useScene();
  const meshRef = useRef<Mesh>(null);

  const mesh = useMemo(() => {
    const geometry = new InstancedBufferGeometry();
    const vertexCount = (SEGMENTS + 1) * 2;
    const ts = new Float32Array(vertexCount);
    const sides = new Float32Array(vertexCount);
    const positions = new Float32Array(vertexCount * 3);
    for (let i = 0; i <= SEGMENTS; i++) {
      ts[i * 2] = i / SEGMENTS;
      ts[i * 2 + 1] = i / SEGMENTS;
      sides[i * 2] = -1;
      sides[i * 2 + 1] = 1;
    }
    const index: number[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geometry.setIndex(index);
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aT", new Float32BufferAttribute(ts, 1));
    geometry.setAttribute("aSide", new Float32BufferAttribute(sides, 1));
    const to = new InstancedBufferAttribute(new Float32Array(MAX_BEAMS * 3), 3);
    to.setUsage(DynamicDrawUsage);
    const beam = new InstancedBufferAttribute(new Float32Array(MAX_BEAMS * 4), 4);
    beam.setUsage(DynamicDrawUsage);
    geometry.setAttribute("aTo", to);
    geometry.setAttribute("aBeam", beam);
    geometry.instanceCount = 0;
    const material = new ShaderMaterial({
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      uniforms: {
        uFrom: { value: new Vector3() },
        uWidth: { value: profile.mobile ? 0.0048 : 0.0034 },
        uTime: { value: 0 },
        uGold: { value: new Color(ACCENT) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const object = new Mesh(geometry, material);
    object.frustumCulled = false;
    object.renderOrder = 6;
    object.visible = false;
    return object;
  }, [profile.mobile]);

  useEffect(() => {
    const mounted = meshRef.current;
    return () => {
      if (!mounted) return;
      mounted.geometry.dispose();
      (mounted.material as ShaderMaterial).dispose();
    };
  }, []);

  useFrame((state) => {
    const object = meshRef.current;
    if (!object) return;
    const rt = runtimeRef.current;
    const geometry = object.geometry as InstancedBufferGeometry;
    const to = geometry.getAttribute("aTo") as InstancedBufferAttribute;
    const beam = geometry.getAttribute("aBeam") as InstancedBufferAttribute;
    const toArr = to.array as Float32Array;
    const beamArr = beam.array as Float32Array;
    let count = 0;
    for (const b of rt.beams) {
      if (count >= MAX_BEAMS || b.alpha <= 0.001) continue;
      const i = b.index;
      toArr[count * 3] = rt.positions[i * 3];
      toArr[count * 3 + 1] = rt.positions[i * 3 + 1];
      toArr[count * 3 + 2] = rt.positions[i * 3 + 2];
      beamArr[count * 4] = b.alpha;
      beamArr[count * 4 + 1] = b.lock;
      beamArr[count * 4 + 2] = b.seed;
      beamArr[count * 4 + 3] = b.reach;
      count += 1;
    }
    to.needsUpdate = true;
    beam.needsUpdate = true;
    geometry.instanceCount = count;
    object.visible = count > 0;
    const uniforms = (object.material as ShaderMaterial).uniforms;
    uniforms.uTime.value = state.clock.elapsedTime;
    (uniforms.uFrom.value as Vector3).copy(rt.beamOrigin);
  });

  return <primitive object={mesh} ref={meshRef} />;
}
