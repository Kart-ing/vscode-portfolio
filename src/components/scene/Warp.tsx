"use client";

// The warp-in: a tunnel of streaking stars around the camera's rush toward
// the map, and a year counter that ticks up as the stars ignite in start
// order. Both are driven by the intro runtime the Choreographer advances.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineSegments,
  MathUtils,
  PerspectiveCamera,
  ShaderMaterial,
  Vector3,
} from "three";
import { hashString, seededRandom } from "./layout";
import { streakFragment, streakVertex } from "./shaders";
import { useScene } from "./SceneContext";

function buildStreaks(count: number): BufferGeometry {
  const rand = seededRandom(hashString("warp"));
  const positions = new Float32Array(count * 6);
  const ends = new Float32Array(count * 2);
  const seeds = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 2.5 + Math.pow(rand(), 0.7) * 48;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = -rand() * 320 + 20;
    const seed = rand();
    for (let v = 0; v < 2; v++) {
      positions[i * 6 + v * 3] = x;
      positions[i * 6 + v * 3 + 1] = y;
      positions[i * 6 + v * 3 + 2] = z;
      ends[i * 2 + v] = v;
      seeds[i * 2 + v] = seed;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aEnd", new Float32BufferAttribute(ends, 1));
  geometry.setAttribute("aSeed", new Float32BufferAttribute(seeds, 1));
  return geometry;
}

export function Warp() {
  const { layout, profile, runtimeRef, reducedMotion } = useScene();
  const tunnelRef = useRef<Group>(null);
  const linesRef = useRef<LineSegments>(null);
  const anchorRef = useRef<Group>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLSpanElement>(null);
  const shown = useRef({ year: -1, count: -1, alpha: -1 });
  const scratch = useMemo(
    () => ({ forward: new Vector3(), right: new Vector3(), up: new Vector3() }),
    [],
  );

  const lines = useMemo(() => {
    const geometry = buildStreaks(profile.streakCount);
    const material = new ShaderMaterial({
      vertexShader: streakVertex,
      fragmentShader: streakFragment,
      uniforms: {
        uScroll: { value: 0 },
        uWarp: { value: 0 },
        uLength: { value: 36 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    const object = new LineSegments(geometry, material);
    object.frustumCulled = false;
    object.renderOrder = 8;
    object.visible = false;
    return object;
  }, [profile.streakCount]);

  useEffect(() => {
    const mounted = linesRef.current;
    return () => {
      if (!mounted) return;
      mounted.geometry.dispose();
      (mounted.material as ShaderMaterial).dispose();
    };
  }, []);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const rt = runtimeRef.current;
    const intro = rt.intro;
    const camera = state.camera as PerspectiveCamera;
    const tunnel = tunnelRef.current;
    const streaks = linesRef.current;
    if (tunnel && streaks) {
      const active = !reducedMotion && intro.warp > 0.002;
      streaks.visible = active;
      if (active) {
        tunnel.position.copy(camera.position);
        tunnel.quaternion.copy(camera.quaternion);
        const u = (streaks.material as ShaderMaterial).uniforms;
        u.uWarp.value = intro.warp;
        u.uScroll.value += dt * (40 + 300 * intro.warp);
      }
    }

    const anchor = anchorRef.current;
    const counter = counterRef.current;
    if (anchor && counter) {
      const alpha = reducedMotion ? 0 : intro.yearAlpha;
      if (alpha > 0.001) {
        const narrow = state.size.width / Math.max(state.size.height, 1) < 0.9;
        const distance = 30;
        const tanV = Math.tan(MathUtils.degToRad(camera.fov) / 2);
        const h = distance * tanV;
        const w = h * camera.aspect;
        camera.getWorldDirection(scratch.forward);
        scratch.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
        scratch.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
        // Top right on wide screens, clear of the title block and the map;
        // in the free band under the title on narrow ones.
        anchor.position
          .copy(camera.position)
          .addScaledVector(scratch.forward, distance)
          .addScaledVector(scratch.right, narrow ? 0 : w * 0.56)
          .addScaledVector(scratch.up, narrow ? h * 0.4 : h * 0.58);
      }
      if (Math.abs(alpha - shown.current.alpha) > 0.005) {
        shown.current.alpha = alpha;
        counter.style.opacity = alpha.toFixed(3);
      }
      if (intro.year !== shown.current.year && yearRef.current) {
        shown.current.year = intro.year;
        yearRef.current.textContent = String(intro.year);
      }
      if (intro.litCount !== shown.current.count && captionRef.current) {
        shown.current.count = intro.litCount;
        captionRef.current.textContent = `${intro.litCount} of ${layout.stars.length} lit`;
      }
    }
  });

  return (
    <>
      <group ref={tunnelRef}>
        <primitive object={lines} ref={linesRef} />
      </group>
      <group ref={anchorRef}>
        <Html center zIndexRange={[8, 0]} pointerEvents="none" style={{ pointerEvents: "none" }}>
          <div ref={counterRef} className="sm-year" style={{ opacity: 0 }} aria-hidden>
            <span ref={yearRef} className="sm-year-value">
              2020
            </span>
            <span ref={captionRef} className="sm-year-caption">
              0 of {layout.stars.length} lit
            </span>
          </div>
        </Html>
      </group>
    </>
  );
}
