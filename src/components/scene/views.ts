// Staged arrangements for generated views. Pure functions: a view plus the
// layout gives every selected star a slot in a flat "stage" frame, with the
// axis, ticks, panels, technology nodes and title the view needs. The stage
// always faces the same canonical direction, so the arrangement is identical
// however the camera was orbited when the answer arrived.
//
// The shell leaves the scene one free band: on wide screens a portrait strip
// between the narration column and the card, on phones a short landscape
// strip between the title and the sheet. Stages are laid out for that band's
// orientation and the camera fits them into it.

import { MathUtils, Vector3 } from "three";
import type { GeneratedView } from "@/lib/contract";
import type { StarLayout, StarNode } from "./layout";
import { techKey } from "./meta";
import type { Pose, ViewKind } from "./SceneContext";

export type LabelSide = "right" | "left" | "above" | "below";

export interface StageSlot {
  index: number;
  x: number;
  y: number;
  z: number;
  side: LabelSide;
}

export interface StageTick {
  x: number;
  y: number;
  label: string;
}

export interface StageStem {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface StageTech {
  key: string;
  label: string;
  x: number;
  y: number;
  side: LabelSide;
  /** Star indices that use it. */
  stars: number[];
}

export interface StagePanel {
  index: number;
  x: number;
  y: number;
  align: "below" | "right";
}

export interface Stage {
  kind: ViewKind;
  key: string;
  slots: StageSlot[];
  slotByIndex: Map<number, StageSlot>;
  /** Extents in frame units, for camera fitting. */
  width: number;
  height: number;
  /** Frame-space point that lands at the centre of the free band. */
  targetX: number;
  targetY: number;
  margin: number;
  axis?: {
    vertical: boolean;
    from: { x: number; y: number };
    to: { x: number; y: number };
    ticks: StageTick[];
    stems: StageStem[];
  };
  panels?: StagePanel[];
  techs?: StageTech[];
  title?: { text: string; x: number; y: number };
  labelIds: string[];
}

export interface StageFrame {
  center: Vector3;
  right: Vector3;
  up: Vector3;
  /** Unit vector from the stage toward the camera. */
  camDir: Vector3;
}

/**
 * The free band of the viewport, in normalised device coordinates: centre
 * and full size, both in [-1, 1] units.
 */
export interface ScreenBand {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** Wide screens: x 38%..68%, y 22%..80%, between the narration column and the card. */
export const DESKTOP_BAND: ScreenBand = { cx: 0.06, cy: -0.02, w: 0.6, h: 1.16 };
/** Phones: x 6%..94%, y 24%..46%, between the title and the sheet. */
export const MOBILE_BAND: ScreenBand = { cx: 0, cy: 0.3, w: 1.76, h: 0.44 };

export function bandFor(narrow: boolean): ScreenBand {
  return narrow ? MOBILE_BAND : DESKTOP_BAND;
}

const UP = new Vector3(0, 1, 0);

/** The stage faces the direction the map is first seen from, slightly above it. */
export function canonicalFrame(): StageFrame {
  const azimuth = Math.atan2(-30, 92);
  const elevation = 0.22;
  const camDir = new Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ).normalize();
  const right = new Vector3().crossVectors(UP, camDir).normalize();
  const up = new Vector3().crossVectors(camDir, right).normalize();
  return { center: new Vector3(0, 0, 0), right, up, camDir };
}

export function toWorld(
  frame: StageFrame,
  x: number,
  y: number,
  z: number,
  out: Vector3 = new Vector3(),
): Vector3 {
  return out
    .copy(frame.center)
    .addScaledVector(frame.right, x)
    .addScaledVector(frame.up, y)
    .addScaledVector(frame.camDir, z);
}

/** Camera pose that fits the stage inside the band and centres it there. */
export function stagePose(
  stage: Stage,
  frame: StageFrame,
  fov: number,
  aspect: number,
  band: ScreenBand,
): Pose {
  const tanV = Math.tan(MathUtils.degToRad(fov) / 2);
  const tanH = tanV * aspect;
  const distance = Math.max(
    (stage.width / 2 + stage.margin) / (tanH * (band.w / 2)),
    (stage.height / 2 + stage.margin) / (tanV * (band.h / 2)),
    9,
  );
  // The stage centre must land at the band centre, not the viewport centre.
  const target = toWorld(frame, stage.targetX, stage.targetY, 0)
    .addScaledVector(frame.right, -band.cx * distance * tanH)
    .addScaledVector(frame.up, -band.cy * distance * tanV);
  const position = target.clone().addScaledVector(frame.camDir, distance);
  return { position, target };
}

export function viewKey(view: GeneratedView | null): string {
  if (!view) return "";
  if (view.kind === "constellation") return `constellation:${view.constellation}`;
  return `${view.kind}:${view.starIds.join(",")}`;
}

function selectStars(layout: StarLayout, ids: string[], cap: number): StarNode[] {
  const seen = new Set<number>();
  const stars: StarNode[] = [];
  for (const id of ids) {
    const index = layout.indexById.get(id);
    if (index === undefined || seen.has(index)) continue;
    seen.add(index);
    stars.push(layout.stars[index]);
    if (stars.length >= cap) break;
  }
  return stars;
}

function finish(
  kind: ViewKind,
  key: string,
  slots: StageSlot[],
  rest: Omit<Stage, "kind" | "key" | "slots" | "slotByIndex" | "labelIds">,
  labelIds: string[],
): Stage {
  return {
    kind,
    key,
    slots,
    slotByIndex: new Map(slots.map((slot) => [slot.index, slot])),
    labelIds,
    ...rest,
  };
}

/**
 * Push overlapping 1D positions apart, keeping them inside [-half, half].
 * Neighbours that sit on alternate sides of the axis need less room than
 * second neighbours, which share a side.
 */
function relax(values: number[], gapAdjacent: number, gapSecond: number, half: number): number[] {
  const out = values.slice();
  for (let pass = 0; pass < 16; pass++) {
    let moved = false;
    for (let i = 1; i < out.length; i++) {
      const overlap = out[i - 1] + gapAdjacent - out[i];
      if (overlap > 1e-3) {
        out[i - 1] -= overlap / 2;
        out[i] += overlap / 2;
        moved = true;
      }
      if (i >= 2) {
        const overlap2 = out[i - 2] + gapSecond - out[i];
        if (overlap2 > 1e-3) {
          out[i - 2] -= overlap2 / 2;
          out[i] += overlap2 / 2;
          moved = true;
        }
      }
    }
    for (let i = 0; i < out.length; i++) out[i] = MathUtils.clamp(out[i], -half, half);
    if (!moved) break;
  }
  return out;
}

function timelineStage(key: string, layout: StarLayout, ids: string[], portrait: boolean): Stage | null {
  const stars = selectStars(layout, ids, 12);
  if (stars.length === 0) return null;
  const dated = stars.filter((s) => s.start).sort((a, b) => a.start!.index - b.start!.index);
  const undated = stars.filter((s) => !s.start);

  // Portrait: a vertical axis, every star to its right with a label, so every
  // neighbour needs the full gap. Strip: a horizontal axis, stars alternating
  // above and below it.
  const length = portrait ? Math.max(12, (stars.length - 1) * 2.3 + 3) : 12;
  const gap = portrait ? 2.3 : 1.35;
  const gapSecond = portrait ? 2.3 : 2.7;
  const half = length / 2;
  const axisX = -3.4;
  const starX = -1.0;

  // The axis runs from January of the first year to the end of the last.
  const firstYear = dated.length ? dated[0].start!.year : 2020;
  const lastYear = dated.length ? dated[dated.length - 1].start!.year : 2026;
  const t0 = (firstYear - 2020) * 12;
  const t1 = (lastYear - 2020) * 12 + 12;
  const span = Math.max(t1 - t0, 12);
  const along = (index: number) => -half + ((index - t0) / span) * (length - (undated.length ? 2.4 : 0));

  const evenly = (dated.length - 1) * gap > length * 0.92;
  let coords = dated.map((s, i) =>
    evenly ? -half + (i / Math.max(dated.length - 1, 1)) * (length - 3) : along(s.start!.index),
  );
  coords = relax(coords, gap, gapSecond, half);

  const slots: StageSlot[] = [];
  const stems: StageStem[] = [];
  const ticks: StageTick[] = [];
  // Strip: stars sit close to the axis so their labels stay inside the band.
  const offset = 1.25;

  dated.forEach((star, i) => {
    if (portrait) {
      const y = -coords[i];
      slots.push({ index: star.index, x: starX, y, z: 0, side: "right" });
      stems.push({ x0: axisX, y0: y, x1: starX, y1: y });
    } else {
      const y = i % 2 === 0 ? offset : -offset;
      slots.push({ index: star.index, x: coords[i], y, z: 0, side: y > 0 ? "above" : "below" });
      stems.push({ x0: coords[i], y0: 0, x1: coords[i], y1: y });
    }
  });
  undated.forEach((star, i) => {
    const at = half + 0.4 + i * 1.4;
    if (portrait) {
      slots.push({ index: star.index, x: starX, y: -at, z: 0, side: "right" });
      stems.push({ x0: axisX, y0: -at, x1: starX, y1: -at });
    } else {
      slots.push({ index: star.index, x: at, y: offset * 0.5, z: 0, side: "above" });
      stems.push({ x0: at, y0: 0, x1: at, y1: offset * 0.5 });
    }
  });

  // A tick marks the start of each year the axis covers.
  for (let year = firstYear; year <= lastYear; year++) {
    const a = along((year - 2020) * 12);
    if (a > half) break;
    if (portrait) ticks.push({ x: axisX - 0.5, y: -a, label: String(year) });
    else ticks.push({ x: a, y: -0.55, label: String(year) });
  }
  if (undated.length) {
    const a = half + 0.4;
    if (portrait) ticks.push({ x: axisX - 0.5, y: -a, label: "undated" });
    else ticks.push({ x: a, y: -0.55, label: "undated" });
  }

  const extra = undated.length ? 2.8 : 0;
  return finish(
    "timeline",
    key,
    slots,
    portrait
      ? {
          width: 9.5,
          height: length + extra + 2,
          // The labels hang to the right, so the band centre sits right of the axis.
          targetX: 0.8,
          targetY: 0,
          margin: 1.0,
          axis: {
            vertical: true,
            from: { x: axisX, y: half + 1 },
            to: { x: axisX, y: -(half + extra + 1) },
            ticks,
            stems,
          },
        }
      : {
          width: length + extra + 1.6,
          height: 6.6,
          targetX: extra / 2,
          targetY: 0,
          margin: 0.4,
          axis: {
            vertical: false,
            from: { x: -half - 0.8, y: 0 },
            to: { x: half + extra + 0.8, y: 0 },
            ticks,
            stems,
          },
        },
    stars.map((s) => s.id),
  );
}

function compareStage(key: string, layout: StarLayout, ids: string[], portrait: boolean): Stage | null {
  const stars = selectStars(layout, ids, 3);
  if (stars.length === 0) return null;
  const n = stars.length;
  const slots: StageSlot[] = [];
  const panels: StagePanel[] = [];
  if (portrait) {
    // A vertical lineup with a compact panel beside each star. The panel
    // names the star, so no label competes with the band's edges.
    const step = 5.6;
    stars.forEach((star, i) => {
      const y = ((n - 1) / 2 - i) * step;
      slots.push({ index: star.index, x: -2.9, y, z: 0, side: "above" });
      panels.push({ index: star.index, x: -1.7, y, align: "right" });
    });
    return finish(
      "compare",
      key,
      slots,
      { width: 9.5, height: (n - 1) * step + 4.6, targetX: 0, targetY: 0, margin: 0.6, panels },
      [],
    );
  }
  // Strip: a row of labelled stars; the sheet below carries the facts.
  const step = 4.2;
  stars.forEach((star, i) => {
    const x = (i - (n - 1) / 2) * step;
    slots.push({ index: star.index, x, y: 0, z: 0, side: i % 2 === 0 ? "above" : "below" });
  });
  return finish(
    "compare",
    key,
    slots,
    { width: (n - 1) * step + 4, height: 4.5, targetX: 0, targetY: 0, margin: 0.6 },
    stars.map((s) => s.id),
  );
}

function stackStage(key: string, layout: StarLayout, ids: string[], portrait: boolean): Stage | null {
  const stars = selectStars(layout, ids, 5);
  if (stars.length === 0) return null;
  const n = stars.length;

  // Technologies, merged by canonical key, keeping the first display name.
  const techByKey = new Map<string, { label: string; stars: number[] }>();
  stars.forEach((star) => {
    for (const name of star.stack) {
      const k = techKey(name);
      if (!k) continue;
      const entry = techByKey.get(k);
      if (entry) {
        if (!entry.stars.includes(star.index)) entry.stars.push(star.index);
      } else techByKey.set(k, { label: name.trim(), stars: [star.index] });
    }
  });

  const slots: StageSlot[] = [];
  const techs: StageTech[] = [];

  if (portrait) {
    // Stars down the left, technologies down the right, links between.
    const stepStars = 5.4;
    stars.forEach((star, i) => {
      slots.push({ index: star.index, x: -3.0, y: ((n - 1) / 2 - i) * stepStars, z: 0, side: "above" });
    });
    const list = [...techByKey.entries()];
    const yOf = (index: number) => slots.find((s) => s.index === index)?.y ?? 0;
    list.sort((a, b) => {
      const ya = a[1].stars.reduce((sum, s) => sum + yOf(s), 0) / a[1].stars.length;
      const yb = b[1].stars.reduce((sum, s) => sum + yOf(s), 0) / b[1].stars.length;
      return yb - ya;
    });
    const m = list.length;
    const height = Math.max((n - 1) * stepStars, (m - 1) * 1.9);
    list.forEach(([k, entry], j) => {
      const y = m > 1 ? height / 2 - (j * height) / (m - 1) : 0;
      techs.push({ key: k, label: entry.label, x: 2.4, y, side: "right", stars: entry.stars });
    });
    return finish(
      "stack",
      key,
      slots,
      { width: 10, height: height + 4.5, targetX: 0.6, targetY: 0, margin: 0.8, techs },
      stars.map((s) => s.id),
    );
  }

  // Strip: stars across the top, the most shared technologies in two rows below.
  const stepStars = Math.min(4.5, 11 / Math.max(n - 1, 1));
  stars.forEach((star, i) => {
    slots.push({ index: star.index, x: (i - (n - 1) / 2) * stepStars, y: 1.3, z: 0, side: "above" });
  });
  const list = [...techByKey.entries()]
    .sort((a, b) => b[1].stars.length - a[1].stars.length)
    .slice(0, 8);
  const xOf = (index: number) => slots.find((s) => s.index === index)?.x ?? 0;
  list.sort((a, b) => {
    const xa = a[1].stars.reduce((sum, s) => sum + xOf(s), 0) / a[1].stars.length;
    const xb = b[1].stars.reduce((sum, s) => sum + xOf(s), 0) / b[1].stars.length;
    return xa - xb || b[1].stars.length - a[1].stars.length;
  });
  const m = list.length;
  const width = Math.max((n - 1) * stepStars + 3, m * 1.5);
  list.forEach(([k, entry], j) => {
    const x = m > 0 ? -width / 2 + ((j + 0.5) * width) / m : 0;
    const upper = j % 2 === 0;
    techs.push({
      key: k,
      label: entry.label,
      x,
      y: upper ? -0.8 : -2.0,
      side: upper ? "above" : "below",
      stars: entry.stars,
    });
  });
  return finish(
    "stack",
    key,
    slots,
    { width: width + 1, height: 6.6, targetX: 0, targetY: 0, margin: 0.4, techs },
    stars.map((s) => s.id),
  );
}

function constellationStage(
  key: string,
  layout: StarLayout,
  id: string,
  portrait: boolean,
): Stage | null {
  const constellation = layout.constellations.find((c) => c.id === id);
  if (!constellation || constellation.starIndices.length === 0) return null;
  const members = constellation.starIndices
    .map((index) => layout.stars[index])
    .sort((a, b) => {
      // Dated first, oldest to newest; then heavier first.
      if (a.start && b.start) return a.start.index - b.start.index;
      if (a.start) return -1;
      if (b.start) return 1;
      return b.weight - a.weight;
    });
  const n = members.length;
  const slots: StageSlot[] = [];
  let width: number;
  let height: number;

  if (portrait) {
    // A vertical zigzag, labels alternating left and right.
    const step = n > 5 ? 2.5 : 3.2;
    members.forEach((star, i) => {
      const y = ((n - 1) / 2 - i) * step;
      const x = n > 4 ? (i % 2 === 0 ? -1.9 : 1.9) : 0;
      slots.push({ index: star.index, x, y, z: 0, side: n > 4 ? (x < 0 ? "left" : "right") : "right" });
    });
    width = 9;
    height = (n - 1) * step + 4;
  } else {
    // A horizontal zigzag across the strip, labels above and below.
    const step = n > 1 ? Math.min(3.6, 12 / (n - 1)) : 0;
    members.forEach((star, i) => {
      const x = (i - (n - 1) / 2) * step;
      const upper = i % 2 === 0;
      const y = n > 4 ? (upper ? 1.1 : -1.1) : 0;
      slots.push({ index: star.index, x, y, z: 0, side: upper ? "above" : "below" });
    });
    width = (n - 1) * step + 3;
    height = 5.6;
  }

  return finish(
    "constellation",
    key,
    slots,
    {
      width,
      height,
      targetX: 0,
      targetY: 0,
      margin: portrait ? 1.0 : 0.5,
      // The strip has no room for a title above the labels; the sheet names the constellation.
      title: portrait ? { text: constellation.label, x: 0, y: height / 2 + 0.4 } : undefined,
    },
    members.map((s) => s.id),
  );
}

/** `portrait` is the free band's orientation: tall on wide screens, a strip on phones. */
export function buildStage(view: GeneratedView | null, layout: StarLayout, portrait: boolean): Stage | null {
  if (!view) return null;
  const key = viewKey(view);
  switch (view.kind) {
    case "timeline":
      return timelineStage(key, layout, view.starIds, portrait);
    case "compare":
      return compareStage(key, layout, view.starIds, portrait);
    case "stack":
      return stackStage(key, layout, view.starIds, portrait);
    case "constellation":
      return constellationStage(key, layout, view.constellation, portrait);
    default:
      return null;
  }
}
