"use client";

// Every star in one instanced draw call of camera-facing glow quads, a second
// instanced mesh of invisible spheres for pointer hit-testing, and one
// LineSegments for the faint constellation figures. Per-frame values go
// through uniforms, never through React state.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
} from "three";
import { useFlight } from "@/lib/flight-state";
import { starFragment, starVertex } from "./shaders";
import { useScene } from "./SceneContext";

const LINE_OPACITY = 0.16;

export function Stars() {
  const { layout, profile, reducedMotion, runtimeRef, hoverId, setHoverId } = useScene();
  const { focusStar } = useFlight();
  const glowRef = useRef<InstancedMesh>(null);
  const hitsRef = useRef<InstancedMesh>(null);
  const linesRef = useRef<LineSegments>(null);
  const cursorRef = useRef("");

  const glow = useMemo(() => {
    const n = layout.stars.length;
    const geometry = new PlaneGeometry(2, 2);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const seeds = new Float32Array(n);
    const indices = new Float32Array(n);
    layout.stars.forEach((star, i) => {
      colors[i * 3] = star.color.r;
      colors[i * 3 + 1] = star.color.g;
      colors[i * 3 + 2] = star.color.b;
      sizes[i] = star.size;
      seeds[i] = star.seed;
      indices[i] = i;
    });
    geometry.setAttribute("aColor", new InstancedBufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new InstancedBufferAttribute(sizes, 1));
    geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    geometry.setAttribute("aIndex", new InstancedBufferAttribute(indices, 1));
    const material = new ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: {
        uTime: { value: 0 },
        uFocus: { value: -1 },
        uDim: { value: 0 },
        uTwinkle: { value: 1 },
        uSizeScale: { value: 1 },
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
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.frustumCulled = false;
    mesh.renderOrder = -5;
    return mesh;
  }, [layout]);

  const lines = useMemo(() => {
    const positions: number[] = [];
    for (const c of layout.constellations) {
      for (const [a, b] of c.segments) {
        const pa = layout.stars[a].position;
        const pb = layout.stars[b].position;
        positions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const material = new LineBasicMaterial({
      color: "#7d9ed6",
      transparent: true,
      opacity: LINE_OPACITY,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const segments = new LineSegments(geometry, material);
    segments.frustumCulled = false;
    segments.renderOrder = 2;
    return segments;
  }, [layout]);

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

  useFrame((state) => {
    const rt = runtimeRef.current;
    const mesh = glowRef.current;
    if (mesh) {
      const u = (mesh.material as ShaderMaterial).uniforms;
      if (!reducedMotion) u.uTime.value = state.clock.elapsedTime;
      u.uTwinkle.value = reducedMotion ? 0 : 1;
      u.uFocus.value = rt.focusIndex;
      u.uDim.value = rt.dim;
      u.uSizeScale.value = profile.mobile ? 1.3 : 1;
    }
    const segments = linesRef.current;
    if (segments) {
      (segments.material as LineBasicMaterial).opacity = LINE_OPACITY * (1 - 0.45 * rt.dim);
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
    if (index !== undefined && layout.stars[index]) focusStar(layout.stars[index].id);
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
