"use client";

// Deep-space backdrop: an inside-out sphere with a cheap fbm shader. It gives
// the dark blue-black some depth and a faint tilted band along the disk.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, Euler, Mesh, ShaderMaterial, Vector3 } from "three";
import { nebulaFragment, nebulaVertex } from "./shaders";
import { useScene } from "./SceneContext";
import { DISK_TILT } from "./tuning";

export const NEBULA_RADIUS = 700;

export function Nebula() {
  const { profile, reducedMotion } = useScene();
  const meshRef = useRef<Mesh>(null);

  const material = useMemo(() => {
    const normal = new Vector3(0, 1, 0).applyEuler(
      new Euler(DISK_TILT.x, 0, DISK_TILT.z, "XYZ"),
    );
    return new ShaderMaterial({
      vertexShader: nebulaVertex,
      fragmentShader: nebulaFragment,
      defines: { OCTAVES: profile.nebulaOctaves },
      uniforms: {
        uTime: { value: 0 },
        uNormal: { value: normal },
        uBase: { value: new Color("#070b16") },
        uTintA: { value: new Color("#152a52") },
        uTintB: { value: new Color("#0d2a3c") },
        uTintC: { value: new Color("#33231a") },
      },
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
  }, [profile.nebulaOctaves]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || reducedMotion) return;
    (mesh.material as ShaderMaterial).uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh ref={meshRef} material={material} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[NEBULA_RADIUS, 24, 16]} />
    </mesh>
  );
}
