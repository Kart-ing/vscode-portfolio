// Deterministic 3D layout of the record. Every position derives from ids
// through a seeded generator, so the map is identical on every reload and on
// every machine, and it never changes when a star is added elsewhere in the
// record unless its own constellation changes.

import { Color, Euler, Vector3 } from "three";
import type {
  ConstellationId,
  Star,
  StarKind,
  StarMeta,
  WorkRecord,
} from "@/lib/contract";
import { firstFacet, resolveMeta, type StartDate } from "./meta";
import { DISK_TILT } from "./tuning";

export interface StarNode {
  id: string;
  /** Index into the layout arrays and the GPU attributes. */
  index: number;
  label: string;
  kind: StarKind;
  constellation: ConstellationId;
  constellationLabel: string;
  weight: 1 | 2 | 3;
  period?: string;
  summary: string;
  /** Home position in the free map. Views move stars away from it and back. */
  position: Vector3;
  /** Linear RGB, ready for shader attributes. */
  color: Color;
  /** Half extent of the glow quad in world units. */
  size: number;
  /** Radius of the invisible sphere used for pointer hit-testing. */
  hitRadius: number;
  /** Stable 0..1 value for twinkle phase. */
  seed: number;
  /** When the work started, or null for undated stars. */
  start: StartDate | null;
  /** 0..n-1 in ignition order: by start, undated last, record order for ties. */
  startRank: number;
  stack: string[];
  repo?: string;
  /** The star's lead fact, for the compare panels. */
  facet?: string;
}

export interface ConstellationNode {
  id: ConstellationId;
  label: string;
  anchor: Vector3;
  labelPosition: Vector3;
  starIndices: number[];
  /** Pairs of star indices joined by a faint line. */
  segments: [number, number][];
}

export interface StarLayout {
  stars: StarNode[];
  constellations: ConstellationNode[];
  indexById: Map<string, number>;
  /** Approximate radius of the whole arrangement. */
  radius: number;
  /** Every constellation segment, flattened, in constellation order. */
  segments: [number, number][];
}

// 32-bit string hash (FNV-1a with a final avalanche). Stable across runtimes.
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

// mulberry32: small, fast, good enough for layout jitter.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const KIND_COLORS: Record<StarKind, string> = {
  company: "#ffd9a3",
  project: "#dfe9ff",
  paper: "#a6cdff",
  patent: "#bdf2e6",
  award: "#ffe58f",
  role: "#f3f0ff",
  education: "#c9d8ff",
  community: "#ffc3aa",
};

const SIZE_BY_WEIGHT: Record<1 | 2 | 3, number> = { 1: 1.05, 2: 1.5, 3: 2.1 };
const HIT_BY_WEIGHT: Record<1 | 2 | 3, number> = { 1: 0.9, 2: 1.1, 3: 1.4 };

const TILT = new Euler(DISK_TILT.x, 0, DISK_TILT.z, "XYZ");

function tilt(v: Vector3): Vector3 {
  return v.applyEuler(TILT);
}

/** Prim's minimum spanning tree over a small point set. */
function spanningTree(points: Vector3[]): [number, number][] {
  const n = points.length;
  if (n < 2) return [];
  const inTree = new Array<boolean>(n).fill(false);
  const best = new Array<number>(n).fill(Infinity);
  const parent = new Array<number>(n).fill(-1);
  best[0] = 0;
  const edges: [number, number][] = [];
  for (let step = 0; step < n; step++) {
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!inTree[i] && (u === -1 || best[i] < best[u])) u = i;
    }
    if (u === -1) break;
    inTree[u] = true;
    if (parent[u] !== -1) edges.push([parent[u], u]);
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue;
      const d = points[u].distanceToSquared(points[v]);
      if (d < best[v]) {
        best[v] = d;
        parent[v] = u;
      }
    }
  }
  return edges;
}

export function buildLayout(
  record: WorkRecord,
  metaOverride: Record<string, StarMeta> | null = null,
): StarLayout {
  const constellationIds = record.constellations.map((c) => c.id);
  const starsByConstellation = new Map<ConstellationId, Star[]>();
  for (const c of record.constellations) starsByConstellation.set(c.id, []);
  for (const star of record.stars) {
    const list = starsByConstellation.get(star.constellation);
    if (list) list.push(star);
    else starsByConstellation.set(star.constellation, [star]);
  }
  // A star whose constellation is missing from the list still gets a home.
  for (const id of starsByConstellation.keys()) {
    if (!constellationIds.includes(id)) constellationIds.push(id);
  }

  const count = Math.max(constellationIds.length, 1);
  const stars: StarNode[] = [];
  const constellations: ConstellationNode[] = [];
  const indexById = new Map<string, number>();

  constellationIds.forEach((cid, i) => {
    const rand = seededRandom(hashString(`constellation:${cid}`));
    const members = starsByConstellation.get(cid) ?? [];
    const label =
      record.constellations.find((c) => c.id === cid)?.label ?? cid;

    // Anchors sit on a wide ring, staggered in radius and height so the
    // arrangement reads as a tilted galactic disk rather than a flat wheel.
    const angle =
      Math.PI * 0.62 + (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.28;
    const ring = (i % 2 === 0 ? 23.5 : 16.5) + (rand() - 0.5) * 3;
    const height = (rand() - 0.5) * 7;
    const anchorFlat = new Vector3(
      Math.cos(angle) * ring,
      height,
      Math.sin(angle) * ring,
    );

    const n = members.length;
    const spread = 2.2 + 1.15 * Math.sqrt(Math.max(n, 1));
    const placedFlat: Vector3[] = [];
    const starIndices: number[] = [];

    members.forEach((star, j) => {
      const srand = seededRandom(hashString(`star:${star.id}`));
      // Heavier stars sit nearer the heart of their constellation.
      const [rMin, rMax] =
        star.weight === 3 ? [0, 0.38] : star.weight === 2 ? [0.32, 0.78] : [0.62, 1.05];
      let bestPos: Vector3 | null = null;
      let bestScore = -Infinity;
      for (let attempt = 0; attempt < 6; attempt++) {
        const theta = j * 2.399963 + (srand() - 0.5) * 1.4 + attempt * 0.9;
        const r = (rMin + (rMax - rMin) * srand()) * spread;
        const y = (srand() - 0.5) * spread * 0.55;
        const candidate = new Vector3(
          anchorFlat.x + Math.cos(theta) * r,
          anchorFlat.y + y,
          anchorFlat.z + Math.sin(theta) * r,
        );
        let minDist = Infinity;
        for (const p of placedFlat) minDist = Math.min(minDist, candidate.distanceTo(p));
        const score = minDist === Infinity ? 1 : minDist;
        if (score > bestScore) {
          bestScore = score;
          bestPos = candidate;
        }
        if (score > 2.2) break;
      }
      const flat = bestPos ?? anchorFlat.clone();
      placedFlat.push(flat);

      const meta = resolveMeta(star, metaOverride?.[star.id]);
      const index = stars.length;
      indexById.set(star.id, index);
      starIndices.push(index);
      stars.push({
        id: star.id,
        index,
        label: star.label,
        kind: star.kind,
        constellation: star.constellation,
        constellationLabel: label,
        weight: star.weight,
        period: star.period,
        summary: star.summary,
        position: tilt(flat.clone()),
        color: new Color(KIND_COLORS[star.kind] ?? "#e6ecff"),
        size: SIZE_BY_WEIGHT[star.weight] ?? 1.2,
        hitRadius: HIT_BY_WEIGHT[star.weight] ?? 1,
        seed: srand(),
        start: meta.start,
        startRank: 0,
        stack: meta.stack,
        repo: meta.repo,
        facet: firstFacet(record.facets, star.id)?.text,
      });
    });

    const localSegments = spanningTree(placedFlat);
    const segments = localSegments.map(
      ([a, b]) => [starIndices[a], starIndices[b]] as [number, number],
    );

    // Label the cluster's centroid, alternating above and below neighbouring
    // clusters so they rarely collide on screen.
    const labelFlat = anchorFlat.clone();
    if (placedFlat.length > 0) {
      labelFlat.set(0, 0, 0);
      for (const flat of placedFlat) labelFlat.add(flat);
      labelFlat.divideScalar(placedFlat.length);
    }
    labelFlat.y += (i % 2 === 0 ? 1 : -1) * (spread * 0.5 + 2.2);
    constellations.push({
      id: cid,
      label,
      anchor: tilt(anchorFlat.clone()),
      labelPosition: tilt(labelFlat),
      starIndices,
      segments,
    });
  });

  // Ignition order: by start date, undated stars last, record order for ties.
  const order = stars
    .map((star) => star.index)
    .sort((a, b) => {
      const sa = stars[a].start;
      const sb = stars[b].start;
      if (sa && sb) return sa.index - sb.index || a - b;
      if (sa) return -1;
      if (sb) return 1;
      return a - b;
    });
  order.forEach((index, rank) => {
    stars[index].startRank = rank;
  });

  let radius = 10;
  for (const s of stars) radius = Math.max(radius, s.position.length());

  const segments = constellations.flatMap((c) => c.segments);
  return { stars, constellations, indexById, radius, segments };
}
