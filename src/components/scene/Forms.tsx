"use client";

// A 3D form for every kind of work, all procedural geometry, one instanced
// draw call per part: the company is an obsidian monolith with gold edges,
// papers and patents are crystals lit from within, awards are gold shards
// orbiting a core, roles are ringed planets, projects are orbiting stations,
// communities are particle rings and education is a lit dome. Forms sit
// inside the glow, read as a bright core from the overview and as objects up
// close. Positions come from the runtime, so they travel with staged views.
//
// The objects are built once inside the frame loop and added to a group, so
// the loop owns them outright and mutates them freely.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  EdgesGeometry,
  Euler,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Object3D,
  OctahedronGeometry,
  Points,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  TetrahedronGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { StarKind } from "@/lib/contract";
import type { StarNode } from "./layout";
import {
  formFragment,
  formVertex,
  orbitPointsFragment,
  orbitPointsVertex,
  planetRingFragment,
  planetRingVertex,
} from "./shaders";
import { useScene } from "./SceneContext";
import { ACCENT } from "./tuning";

const GOLD = new Color(ACCENT);

interface Member {
  star: StarNode;
  /** Sub-instance for multi-part forms such as shards. */
  sub: number;
  count: number;
}

interface FormSet {
  key: string;
  mode: number;
  geometry: BufferGeometry;
  members: Member[];
  place(member: Member, t: number, scale: number, out: Matrix4): void;
}

interface Built {
  meshes: { set: FormSet; mesh: InstancedMesh }[];
  rings: InstancedMesh;
  ringMembers: Member[];
  edges: { star: StarNode; line: LineSegments }[];
  edgesGeometry: EdgesGeometry;
  orbits: { star: StarNode; points: Points }[];
  objects: Object3D[];
}

const position = new Vector3();
const quaternion = new Quaternion();
const scaleVector = new Vector3();
const euler = new Euler();
const offset = new Vector3();
const matrix = new Matrix4();

/** Base scale for a star's form, from its glow size. */
function formScale(star: StarNode): number {
  return 0.74 + 0.4 * ((star.size - 1.05) / 1.05);
}

function compose(out: Matrix4, s: number, e: Euler, sx = 1, sy = 1, sz = 1) {
  quaternion.setFromEuler(e);
  scaleVector.set(s * sx, s * sy, s * sz);
  out.compose(position, quaternion, scaleVector);
}

function station(): BufferGeometry {
  const parts: BufferGeometry[] = [new TorusGeometry(0.6, 0.06, 8, 36)];
  for (let i = 0; i < 4; i++) {
    const spoke = new CylinderGeometry(0.026, 0.026, 1.2, 6);
    spoke.rotateZ(Math.PI / 2 + (i * Math.PI) / 4);
    parts.push(spoke);
  }
  parts.push(new SphereGeometry(0.15, 12, 8));
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged ?? new TorusGeometry(0.6, 0.06, 8, 36);
}

function dome(): BufferGeometry {
  const cap = new SphereGeometry(0.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const base = new CylinderGeometry(0.66, 0.66, 0.05, 24);
  base.translate(0, -0.025, 0);
  const merged = mergeGeometries([cap, base], false);
  cap.dispose();
  base.dispose();
  return merged ?? new SphereGeometry(0.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
}

function createFormMaterial(mode: number): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: formVertex,
    fragmentShader: formFragment,
    uniforms: {
      uMode: { value: mode },
      uTime: { value: 0 },
      uGold: { value: GOLD },
    },
  });
}

function instanced(set: FormSet): InstancedMesh {
  const n = Math.max(set.members.length, 1);
  const tints = new Float32Array(n * 3);
  const state = new Float32Array(n * 4);
  set.members.forEach((member, i) => {
    tints[i * 3] = member.star.color.r;
    tints[i * 3 + 1] = member.star.color.g;
    tints[i * 3 + 2] = member.star.color.b;
    state[i * 4] = 1;
    state[i * 4 + 1] = 1;
    state[i * 4 + 3] = member.star.seed;
  });
  const geometry = set.geometry;
  geometry.setAttribute("aTint", new InstancedBufferAttribute(tints, 3));
  const stateAttribute = new InstancedBufferAttribute(state, 4);
  stateAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("aState", stateAttribute);
  const mesh = new InstancedMesh(geometry, createFormMaterial(set.mode), n);
  mesh.count = set.members.length;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.visible = set.members.length > 0;
  return mesh;
}

function build(byKind: Map<StarKind, StarNode[]>): Built {
  const members = (kind: StarKind, perStar: (star: StarNode) => number = () => 1): Member[] => {
    const list = byKind.get(kind) ?? [];
    const out: Member[] = [];
    for (const star of list) {
      const count = perStar(star);
      for (let sub = 0; sub < count; sub++) out.push({ star, sub, count });
    }
    return out;
  };
  const monolithGeometry = new BoxGeometry(0.5, 1.45, 0.26);
  const sets: FormSet[] = [
    {
      key: "monolith",
      mode: 0,
      geometry: monolithGeometry,
      members: members("company"),
      place: (m, t, s, out) => {
        euler.set(0.1, t * 0.28 + m.star.seed * 6.28, 0.05);
        compose(out, s * 1.3, euler);
      },
    },
    {
      key: "paper",
      mode: 1,
      geometry: new IcosahedronGeometry(0.55, 0),
      members: members("paper"),
      place: (m, t, s, out) => {
        euler.set(t * 0.31 + m.star.seed * 6, t * 0.47 + m.star.seed * 3, 0.2);
        compose(out, s, euler);
      },
    },
    {
      key: "patent",
      mode: 1,
      geometry: new OctahedronGeometry(0.64, 0),
      members: members("patent"),
      place: (m, t, s, out) => {
        euler.set(0.35, t * 0.4 + m.star.seed * 6, t * 0.18);
        compose(out, s, euler, 0.8, 1.15, 0.8);
      },
    },
    {
      key: "shards",
      mode: 2,
      geometry: new TetrahedronGeometry(0.2, 0),
      members: members("award", (star) => 3 + Math.floor(star.seed * 3)),
      place: (m, t, s, out) => {
        const angle = t * 0.85 + (m.sub / m.count) * Math.PI * 2 + m.star.seed * 6.28;
        const tilt = 0.5 + m.star.seed * 0.6;
        offset.set(
          Math.cos(angle) * 0.46,
          Math.sin(angle) * 0.46 * Math.sin(tilt),
          Math.sin(angle) * 0.46 * Math.cos(tilt),
        );
        position.addScaledVector(offset, s);
        euler.set(offset.z * 2.4, angle, offset.x * 2.4 + t * 0.6);
        compose(out, s, euler, 0.75, 2.6, 0.75);
      },
    },
    {
      key: "cores",
      mode: 2,
      geometry: new SphereGeometry(0.14, 12, 8),
      members: members("award"),
      place: (m, t, s, out) => {
        euler.set(0, t * 0.5, 0);
        compose(out, s, euler);
      },
    },
    {
      key: "planets",
      mode: 3,
      geometry: new SphereGeometry(0.5, 24, 16),
      members: members("role"),
      place: (m, t, s, out) => {
        euler.set(0.32, t * 0.3 + m.star.seed * 6.28, 0.1);
        compose(out, s, euler);
      },
    },
    {
      key: "stations",
      mode: 4,
      geometry: station(),
      members: members("project"),
      place: (m, t, s, out) => {
        euler.set(0.95 + m.star.seed * 0.5, m.star.seed * 6.28 + t * 0.08, t * 0.38 + m.star.seed * 4);
        compose(out, s, euler);
      },
    },
    {
      key: "domes",
      mode: 5,
      geometry: dome(),
      members: members("education"),
      place: (m, t, s, out) => {
        euler.set(0, t * 0.16 + m.star.seed * 6.28, 0);
        compose(out, s, euler);
      },
    },
  ];
  const meshes = sets.map((set) => ({ set, mesh: instanced(set) }));

  // Planet rings share the planets' members but need a transparent material.
  const ringMembers = members("role");
  const ringGeometry = new RingGeometry(0.72, 1.06, 48);
  const ringCount = Math.max(ringMembers.length, 1);
  const ringTints = new Float32Array(ringCount * 3);
  const ringState = new Float32Array(ringCount * 4);
  ringMembers.forEach((m, i) => {
    ringTints[i * 3] = m.star.color.r;
    ringTints[i * 3 + 1] = m.star.color.g;
    ringTints[i * 3 + 2] = m.star.color.b;
    ringState[i * 4] = 1;
    ringState[i * 4 + 1] = 1;
  });
  ringGeometry.setAttribute("aTint", new InstancedBufferAttribute(ringTints, 3));
  const ringStateAttribute = new InstancedBufferAttribute(ringState, 4);
  ringStateAttribute.setUsage(DynamicDrawUsage);
  ringGeometry.setAttribute("aState", ringStateAttribute);
  const rings = new InstancedMesh(
    ringGeometry,
    new ShaderMaterial({
      vertexShader: planetRingVertex,
      fragmentShader: planetRingFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    }),
    ringCount,
  );
  rings.count = ringMembers.length;
  rings.instanceMatrix.setUsage(DynamicDrawUsage);
  rings.frustumCulled = false;
  rings.renderOrder = 3;
  rings.visible = ringMembers.length > 0;

  // Gold edges for each monolith.
  const edgesGeometry = new EdgesGeometry(monolithGeometry, 20);
  const edges = (byKind.get("company") ?? []).map((star) => {
    const line = new LineSegments(
      edgesGeometry,
      new LineBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    line.matrixAutoUpdate = false;
    line.frustumCulled = false;
    line.renderOrder = 4;
    return { star, line };
  });

  // Particle rings for communities.
  const orbits = (byKind.get("community") ?? []).map((star) => {
    const count = 150;
    const angles = new Float32Array(count);
    const radii = new Float32Array(count);
    const seeds = new Float32Array(count);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      angles[i] = (i / count) * Math.PI * 2 + ((i * 7919) % 97) / 97;
      radii[i] = 0.78 + (((i * 104729) % 101) / 101) * 0.22;
      seeds[i] = ((i * 15485863) % 1009) / 1009;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aAngle", new Float32BufferAttribute(angles, 1));
    geometry.setAttribute("aRadius", new Float32BufferAttribute(radii, 1));
    geometry.setAttribute("aSeed", new Float32BufferAttribute(seeds, 1));
    const material = new ShaderMaterial({
      vertexShader: orbitPointsVertex,
      fragmentShader: orbitPointsFragment,
      uniforms: {
        uTime: { value: 0 },
        uVis: { value: 1 },
        uPixelRatio: { value: 1 },
        uScale: { value: 60 },
        uTint: { value: star.color.clone() },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 4;
    return { star, points };
  });

  const objects: Object3D[] = [
    ...meshes.map(({ mesh }) => mesh),
    rings,
    ...edges.map(({ line }) => line),
    ...orbits.map(({ points }) => points),
  ];
  return { meshes, rings, ringMembers, edges, edgesGeometry, orbits, objects };
}

function dispose(built: Built) {
  for (const { mesh } of built.meshes) {
    mesh.geometry.dispose();
    (mesh.material as ShaderMaterial).dispose();
  }
  built.rings.geometry.dispose();
  (built.rings.material as ShaderMaterial).dispose();
  built.edgesGeometry.dispose();
  for (const { line } of built.edges) (line.material as LineBasicMaterial).dispose();
  for (const { points } of built.orbits) {
    points.geometry.dispose();
    (points.material as ShaderMaterial).dispose();
  }
}

export function Forms() {
  const { layout, runtimeRef, reducedMotion } = useScene();
  const groupRef = useRef<Group>(null);
  const builtRef = useRef<Built | null>(null);

  const byKind = useMemo(() => {
    const map = new Map<StarKind, StarNode[]>();
    for (const star of layout.stars) {
      const list = map.get(star.kind);
      if (list) list.push(star);
      else map.set(star.kind, [star]);
    }
    return map;
  }, [layout]);

  // Release GPU resources on unmount.
  useEffect(() => {
    const group = groupRef.current;
    return () => {
      const built = builtRef.current;
      if (!built) return;
      builtRef.current = null;
      for (const object of built.objects) group?.remove(object);
      dispose(built);
    };
  }, []);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    if (!builtRef.current) {
      const fresh = build(byKind);
      builtRef.current = fresh;
      for (const object of fresh.objects) group.add(object);
    }
    const built = builtRef.current;
    if (!built) return;
    const rt = runtimeRef.current;
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    const p = rt.positions;
    const vis = (star: StarNode) => rt.lit[star.index] * rt.filter[star.index];
    const focus = (star: StarNode) => (rt.focusIndex === star.index ? 1 : 0);

    for (let k = 0; k < built.meshes.length; k++) {
      const set = built.meshes[k].set;
      const mesh = built.meshes[k].mesh;
      const attribute = mesh.geometry.getAttribute("aState") as InstancedBufferAttribute;
      const arr = attribute.array as Float32Array;
      (mesh.material as ShaderMaterial).uniforms.uTime.value = t;
      set.members.forEach((member, i) => {
        const star = member.star;
        const v = vis(star);
        const emphasis = rt.emphasis[star.index];
        position.set(p[star.index * 3], p[star.index * 3 + 1], p[star.index * 3 + 2]);
        const s =
          formScale(star) * (0.15 + 0.85 * v) * (0.7 + 0.3 * emphasis) * (1 + 0.4 * focus(star));
        set.place(member, t, s, matrix);
        mesh.setMatrixAt(i, matrix);
        arr[i * 4] = v;
        arr[i * 4 + 1] = emphasis;
        arr[i * 4 + 2] = focus(star);
      });
      mesh.instanceMatrix.needsUpdate = true;
      attribute.needsUpdate = true;
    }

    const rings = built.rings;
    const ringState = rings.geometry.getAttribute("aState") as InstancedBufferAttribute;
    const ringArr = ringState.array as Float32Array;
    built.ringMembers.forEach((member, i) => {
      const star = member.star;
      const v = vis(star);
      position.set(p[star.index * 3], p[star.index * 3 + 1], p[star.index * 3 + 2]);
      const s = formScale(star) * (0.15 + 0.85 * v);
      euler.set(1.22 + star.seed * 0.3, star.seed * 2, 0.28);
      compose(matrix, s, euler);
      rings.setMatrixAt(i, matrix);
      ringArr[i * 4] = v;
      ringArr[i * 4 + 1] = rt.emphasis[star.index];
    });
    rings.instanceMatrix.needsUpdate = true;
    ringState.needsUpdate = true;

    for (let k = 0; k < built.edges.length; k++) {
      const star = built.edges[k].star;
      const line = built.edges[k].line;
      const v = vis(star);
      position.set(p[star.index * 3], p[star.index * 3 + 1], p[star.index * 3 + 2]);
      euler.set(0.1, t * 0.28 + star.seed * 6.28, 0.05);
      compose(
        line.matrix,
        formScale(star) * 1.3 * (0.15 + 0.85 * v) * (0.7 + 0.3 * rt.emphasis[star.index]) * (1 + 0.4 * focus(star)),
        euler,
      );
      line.matrixWorldNeedsUpdate = true;
      const material = line.material as LineBasicMaterial;
      material.opacity = 0.85 * v * (0.3 + 0.7 * rt.emphasis[star.index]) * (1 + 0.4 * focus(star));
      line.visible = v > 0.01;
    }

    for (let k = 0; k < built.orbits.length; k++) {
      const star = built.orbits[k].star;
      const points = built.orbits[k].points;
      const v = vis(star);
      points.position.set(p[star.index * 3], p[star.index * 3 + 1], p[star.index * 3 + 2]);
      points.rotation.set(0.35, star.seed * 3, 0.15);
      points.scale.setScalar(formScale(star) * (0.15 + 0.85 * v));
      const u = (points.material as ShaderMaterial).uniforms;
      u.uTime.value = t;
      u.uVis.value = v * (0.35 + 0.65 * rt.emphasis[star.index]) * (1 + 0.5 * focus(star));
      u.uPixelRatio.value = state.viewport.dpr;
      points.visible = v > 0.01;
    }
  });

  return <group ref={groupRef} />;
}
