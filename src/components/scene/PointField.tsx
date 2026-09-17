"use client";

// One draw call of soft points. Used twice: drifting dust around the map, and
// a static shell of distant stars for depth. Drift and swirl happen in the
// vertex shader, so the CPU never touches the buffers after creation.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Euler,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import { useSignals } from "./signals";
import { hashString, seededRandom } from "./layout";
import { pointFragment, pointVertex } from "./shaders";
import { useScene } from "./SceneContext";
import { DISK_TILT } from "./tuning";

interface PointFieldProps {
  count: number;
  seed: string;
  distribution: "disk" | "shell";
  /** Point size range before attenuation. */
  sizeRange: [number, number];
  /** Attenuation scale: a point of size 1 at this distance is 1px. */
  scale: number;
  maxSize: number;
  opacity: number;
  colorA: string;
  colorB: string;
  /** Slow drift, and the swirl while a question is in flight. */
  animated: boolean;
}

const TILT = new Euler(DISK_TILT.x, 0, DISK_TILT.z, "XYZ");

function buildGeometry(
  count: number,
  seed: string,
  distribution: "disk" | "shell",
  sizeMin: number,
  sizeMax: number,
): BufferGeometry {
  const rand = seededRandom(hashString(`field:${seed}`));
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const v = new Vector3();
  for (let i = 0; i < count; i++) {
    if (distribution === "disk") {
      const inShell = rand() < 0.22;
      if (inShell) {
        const r = 70 + rand() * 90;
        const theta = rand() * Math.PI * 2;
        const u = rand() * 2 - 1;
        const s = Math.sqrt(1 - u * u);
        v.set(Math.cos(theta) * s * r, u * r * 0.8, Math.sin(theta) * s * r);
      } else {
        const r = 6 + 92 * Math.pow(rand(), 0.62);
        const theta = rand() * Math.PI * 2;
        const y = (rand() + rand() + rand() - 1.5) * 11;
        v.set(Math.cos(theta) * r, y, Math.sin(theta) * r);
        v.applyEuler(TILT);
      }
    } else {
      const r = 300 + rand() * 140;
      const theta = rand() * Math.PI * 2;
      const u = rand() * 2 - 1;
      const s = Math.sqrt(1 - u * u);
      v.set(Math.cos(theta) * s * r, u * r, Math.sin(theta) * s * r);
    }
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    seeds[i] = rand();
    sizes[i] = sizeMin + (sizeMax - sizeMin) * rand();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new Float32BufferAttribute(seeds, 1));
  geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
  return geometry;
}

export function PointField(props: PointFieldProps) {
  const { count, seed, distribution, scale, maxSize, opacity, colorA, colorB, animated } =
    props;
  const sizeMin = props.sizeRange[0];
  const sizeMax = props.sizeRange[1];
  const { reducedMotion, runtimeRef } = useScene();
  const { status } = useSignals();
  const pointsRef = useRef<Points>(null);
  const swirlVelocity = useRef(0);
  const swirlAngle = useRef(0);

  const points = useMemo(() => {
    const geometry = buildGeometry(count, seed, distribution, sizeMin, sizeMax);
    const material = new ShaderMaterial({
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
      uniforms: {
        uTime: { value: 0 },
        uDrift: { value: 0 },
        uSwirl: { value: 0 },
        uSwirlAngle: { value: 0 },
        uPixelRatio: { value: 1 },
        uScale: { value: scale },
        uMaxSize: { value: maxSize },
        uOpacity: { value: opacity },
        uBoost: { value: 1 },
        uColorA: { value: new Color(colorA) },
        uColorB: { value: new Color(colorB) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
    });
    const mesh = new Points(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }, [count, seed, distribution, sizeMin, sizeMax, scale, maxSize, opacity, colorA, colorB]);

  useEffect(() => {
    const mounted = pointsRef.current;
    return () => {
      if (!mounted) return;
      mounted.geometry.dispose();
      (mounted.material as ShaderMaterial).dispose();
    };
  }, []);

  useFrame((state, rawDelta) => {
    const mesh = pointsRef.current;
    if (!mesh) return;
    const delta = Math.min(rawDelta, 0.05);
    const u = (mesh.material as ShaderMaterial).uniforms;
    u.uPixelRatio.value = state.viewport.dpr;
    if (reducedMotion) {
      u.uDrift.value = 0;
      u.uSwirl.value = 0;
      return;
    }
    u.uTime.value = state.clock.elapsedTime;
    if (!animated) return;
    u.uDrift.value = 1;
    // While a question is in flight the dust accelerates into a gentle
    // vortex around the centre and eases back out when the answer lands.
    const asking = status === "asking";
    const targetVelocity = asking ? 0.6 : 0;
    swirlVelocity.current +=
      (targetVelocity - swirlVelocity.current) *
      (1 - Math.exp(-delta * (asking ? 1.6 : 2.4)));
    swirlAngle.current += swirlVelocity.current * delta;
    const rt = runtimeRef.current;
    rt.swirl += ((asking ? 1 : 0) - rt.swirl) * (1 - Math.exp(-delta * 1.8));
    u.uSwirl.value = rt.swirl;
    u.uSwirlAngle.value = swirlAngle.current;
    u.uBoost.value = 1 + 0.7 * rt.swirl;
  });

  return <primitive object={points} ref={pointsRef} />;
}
