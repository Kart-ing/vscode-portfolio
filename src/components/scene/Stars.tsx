"use client";

// Every star in one instanced draw call of camera-facing glow quads, a second
// instanced mesh of invisible spheres for pointer hit-testing, and one
// LineSegments for the constellation figures. Positions, ignition, the year
// filter, view emphasis and citation locks arrive through the runtime arrays
// the Choreographer fills, and go to the GPU as instance attributes.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Sphere,
  SphereGeometry,
  Vector3,
} from "three";
import { moveToward } from "./motion";
import { starFragment, starVertex } from "./shaders";
import { useScene } from "./SceneContext";
import { useSignals } from "./signals";

const LINE_OPACITY = 0.16;

export function Stars() {
  const { layout, profile, reducedMotion, runtimeRef, hoverId, setHoverId } = useScene();
  const { focusStar } = useSignals();
  const glowRef = useRef<InstancedMesh>(null);
  const hitsRef = useRef<InstancedMesh>(null);
  const linesRef = useRef<LineSegments>(null);
  const cursorRef = useRef("");
  const matrix = useMemo(() => new Matrix4(), []);

  const glow = useMemo(() => {
    const n = layout.stars.length;
    const geometry = new PlaneGeometry(2, 2);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const seeds = new Float32Array(n);
    const indices = new Float32Array(n);
    const state = new Float32Array(n * 4);
    layout.stars.forEach((star, i) => {
      colors[i * 3] = star.color.r;
      colors[i * 3 + 1] = star.color.g;
      colors[i * 3 + 2] = star.color.b;
      sizes[i] = star.size;
      seeds[i] = star.seed;
      indices[i] = i;
      state[i * 4] = 1;
      state[i * 4 + 1] = 1;
    });
    geometry.setAttribute("aColor", new InstancedBufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new InstancedBufferAttribute(sizes, 1));
    geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    geometry.setAttribute("aIndex", new InstancedBufferAttribute(indices, 1));
    const stateAttribute = new InstancedBufferAttribute(state, 4);
    stateAttribute.setUsage(DynamicDrawUsage);
    geometry.setAttribute("aState", stateAttribute);
    const material = new ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: {
        uTime: { value: 0 },
        uFocus: { value: -1 },
        uDim: { value: 0 },
        uTwinkle: { value: 1 },
        uSizeScale: { value: 1 },
        uCoreFade: { value: 0.96 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
    });
    const mesh = new InstancedMesh(geometry, material, Math.max(n, 1));
    const m = new Matrix4();
    layout.stars.forEach((star, i) => {
      m.makeTranslation(star.position.x, star.position.y, star.position.z);
      mesh.setMatrixAt(i, m);
    });
    mesh.count = n;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    return mesh;
  }, [layout]);

  const hits = useMemo(() => {
    const n = layout.stars.length;
    const geometry = new SphereGeometry(1, 10, 8);
    const material = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const mesh = new InstancedMesh(geometry, material, Math.max(n, 1));
    const m = new Matrix4();
    layout.stars.forEach((star, i) => {
      m.makeScale(star.hitRadius, star.hitRadius, star.hitRadius);
      m.setPosition(star.position);
      mesh.setMatrixAt(i, m);
    });
    mesh.count = n;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    // Stars travel during staged views; one generous sphere covers every pose.
    mesh.boundingSphere = new Sphere(new Vector3(), 400);
    mesh.frustumCulled = false;
    mesh.renderOrder = -5;
    return mesh;
  }, [layout]);

  // Each segment draws from the earlier star toward the later one.
  const segments = useMemo(
    () =>
      layout.segments.map(([a, b]) =>
        layout.stars[a].startRank <= layout.stars[b].startRank ? [a, b] : [b, a],
      ),
    [layout],
  );
  // Per-segment draw progress, 0..1. Lives in a ref: it is frame-loop state.
  const drawRef = useRef<Float32Array | null>(null);

  const lines = useMemo(() => {
    const count = segments.length;
    const geometry = new BufferGeometry();
    const positions = new Float32BufferAttribute(new Float32Array(count * 6), 3);
    positions.setUsage(DynamicDrawUsage);
    const colors = new Float32BufferAttribute(new Float32Array(count * 6), 3);
    colors.setUsage(DynamicDrawUsage);
    geometry.setAttribute("position", positions);
    geometry.setAttribute("color", colors);
    const material = new LineBasicMaterial({
      color: "#7d9ed6",
      vertexColors: true,
      transparent: true,
      opacity: LINE_OPACITY,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const mesh = new LineSegments(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    return mesh;
  }, [segments]);

  // Primitives are not disposed by the reconciler; release GPU resources on unmount.
  useEffect(() => {
    const mounted = [glowRef.current, hitsRef.current, linesRef.current];
    return () => {
      for (const object of mounted) {
        if (!object) continue;
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
    };
  }, []);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const rt = runtimeRef.current;
    const n = layout.stars.length;
    const t = state.clock.elapsedTime;
    const mesh = glowRef.current;
    if (mesh) {
      const u = (mesh.material as ShaderMaterial).uniforms;
      if (!reducedMotion) u.uTime.value = t;
      u.uTwinkle.value = reducedMotion ? 0 : 1;
      u.uFocus.value = rt.focusIndex;
      u.uDim.value = rt.dim;
      u.uSizeScale.value = profile.mobile ? 1.3 : 1;
      const attribute = mesh.geometry.getAttribute("aState") as InstancedBufferAttribute;
      const arr = attribute.array as Float32Array;
      for (let i = 0; i < n; i++) {
        const star = layout.stars[i];
        const age = rt.ignite[i];
        let flash = age >= 0 && age < 1.2 ? Math.exp(-age * 3.2) * 0.9 : 0;
        const pulse = rt.pulse[i];
        if (pulse > 0 && !reducedMotion) {
          const phase = ((t + star.seed * 7) / 2.8) % 1;
          flash += Math.pow(Math.max(0, 1 - phase * 4), 2) * 0.35 * pulse;
        }
        arr[i * 4] = rt.lit[i] * rt.filter[i];
        arr[i * 4 + 1] = rt.emphasis[i];
        arr[i * 4 + 2] = rt.lock[i];
        arr[i * 4 + 3] = flash;
      }
      attribute.needsUpdate = true;
      if (rt.moving) {
        const p = rt.positions;
        for (let i = 0; i < n; i++) {
          matrix.makeTranslation(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
          mesh.setMatrixAt(i, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    const hitMesh = hitsRef.current;
    if (hitMesh && rt.moving) {
      const p = rt.positions;
      for (let i = 0; i < n; i++) {
        const r = layout.stars[i].hitRadius;
        matrix.makeScale(r, r, r);
        matrix.setPosition(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
        hitMesh.setMatrixAt(i, matrix);
      }
      hitMesh.instanceMatrix.needsUpdate = true;
    }
    const segmentMesh = linesRef.current;
    if (segmentMesh) {
      let draw = drawRef.current;
      if (!draw || draw.length !== segments.length) {
        draw = new Float32Array(segments.length).fill(reducedMotion ? 1 : 0);
        drawRef.current = draw;
      }
      const positions = segmentMesh.geometry.getAttribute("position") as Float32BufferAttribute;
      const colors = segmentMesh.geometry.getAttribute("color") as Float32BufferAttribute;
      const pa = positions.array as Float32Array;
      const ca = colors.array as Float32Array;
      const p = rt.positions;
      for (let k = 0; k < segments.length; k++) {
        const [a, b] = segments[k];
        // A line draws itself once both ends have ignited.
        const target = rt.lit[a] > 0 && rt.lit[b] > 0 ? 1 : 0;
        draw[k] = reducedMotion ? target : moveToward(draw[k], target, 1 / 0.45, dt);
        const d = draw[k];
        const ax = p[a * 3];
        const ay = p[a * 3 + 1];
        const az = p[a * 3 + 2];
        pa[k * 6] = ax;
        pa[k * 6 + 1] = ay;
        pa[k * 6 + 2] = az;
        pa[k * 6 + 3] = ax + (p[b * 3] - ax) * d;
        pa[k * 6 + 4] = ay + (p[b * 3 + 1] - ay) * d;
        pa[k * 6 + 5] = az + (p[b * 3 + 2] - az) * d;
        const vis = Math.min(rt.lit[a] * rt.filter[a], rt.lit[b] * rt.filter[b]);
        const emphasis = Math.pow(Math.min(rt.emphasis[a], rt.emphasis[b]), 0.8);
        const bright = vis * emphasis * (1 - 0.45 * rt.dim) * (1 + 0.8 * Math.max(rt.lock[a], rt.lock[b]));
        const lockMix = Math.max(rt.lock[a], rt.lock[b]) * 0.6;
        const r = bright * (1 + lockMix * 0.9);
        const g = bright * (1 + lockMix * 0.5);
        const bl = bright * (1 - lockMix * 0.3);
        ca[k * 6] = r;
        ca[k * 6 + 1] = g;
        ca[k * 6 + 2] = bl;
        ca[k * 6 + 3] = r;
        ca[k * 6 + 4] = g;
        ca[k * 6 + 5] = bl;
      }
      positions.needsUpdate = true;
      colors.needsUpdate = true;
    }
    const cursor = hoverId ? "pointer" : "";
    if (cursor !== cursorRef.current) {
      cursorRef.current = cursor;
      state.gl.domElement.style.cursor = cursor;
    }
  });

  const onPointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const index = event.instanceId;
    if (index !== undefined && layout.stars[index]) setHoverId(layout.stars[index].id);
  };
  const onPointerOut = () => setHoverId(null);
  const onClick = (event: ThreeEvent<MouseEvent>) => {
    // A drag that happens to start and end on a star is an orbit, not a click.
    if (event.delta > 6) return;
    event.stopPropagation();
    const index = event.instanceId;
    if (index === undefined || !layout.stars[index]) return;
    // Unlit or filtered-out stars are not there to be clicked.
    const rt = runtimeRef.current;
    if (rt.lit[index] * rt.filter[index] < 0.3) return;
    focusStar(layout.stars[index].id);
  };

  return (
    <>
      <primitive object={lines} ref={linesRef} />
      <primitive object={glow} ref={glowRef} />
      <primitive
        object={hits}
        ref={hitsRef}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onClick={onClick}
      />
    </>
  );
}
