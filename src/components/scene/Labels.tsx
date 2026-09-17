"use client";

// DOM labels through drei's Html: crisp at any pixel ratio and outside the
// bloom pass. Constellation names show softly in the overview and fade to
// almost nothing while a star is focused, a plan is active or a view is
// staged. Two constellation labels that would overlap on screen resolve by
// hiding the farther one. Star names show on hover, when the camera is
// close, or when a staged view asks for them; the focused star's name is
// left to the card. Labels follow the runtime positions, so they travel with
// the stars.
//
// While an answer or a view is showing, the shell's narration column, card,
// prompt and sheet cover parts of the viewport with translucent plates; any
// label that would sit under them is withheld. On phones a staged view
// labels only its few most relevant stars. The visible sets are recomputed a
// few times a second and only committed when they change.

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import { Group, Vector3 } from "three";
import type { StarNode } from "./layout";
import { useScene } from "./SceneContext";
import { useSignals } from "./signals";
import { sceneTuning } from "./tuning";

const LABEL_PX_PER_CHAR = 8.6;
const LABEL_HEIGHT_PX = 14;
/** Star labels: 11px DM Mono uppercase with tracking, two lines with a period. */
const STAR_PX_PER_CHAR = 7.9;
const STAR_LINE_PX = 13;
/** Most relevant stars a phone-sized staged view labels. */
const MOBILE_VIEW_LABELS = 4;

type Side = "right" | "left" | "above" | "below";

interface Projected {
  id: string;
  x: number;
  y: number;
  z: number;
  halfWidth: number;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Candidate {
  star: StarNode;
  side: Side;
  rect: Rect;
  /** The opposite side, when it is also clear of the shell. */
  alt: { side: Side; rect: Rect } | null;
}

const FLIP: Record<Side, Side> = { right: "left", left: "right", above: "below", below: "above" };

function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Screen box of a star label whose anchor (the Html position) projects to (x, y). */
function labelRect(star: StarNode, side: Side, x: number, y: number, compact: boolean): Rect {
  // The period line is smaller type but can be the longer of the two.
  const period = compact ? 0 : (star.period?.length ?? 0) * 0.86;
  const width = Math.max(star.label.length, period) * STAR_PX_PER_CHAR;
  const height = star.period && !compact ? STAR_LINE_PX * 2 + 4 : STAR_LINE_PX;
  switch (side) {
    case "left":
      return { left: x - 4 - width, right: x - 4, top: y - height / 2, bottom: y + height / 2 };
    case "above":
      return { left: x - width / 2, right: x + width / 2, top: y - 6 - height, bottom: y - 6 };
    case "below":
      return { left: x - width / 2, right: x + width / 2, top: y + 6, bottom: y + 6 + height };
    default:
      return { left: x + 4, right: x + 4 + width, top: y - height / 2, bottom: y + height / 2 };
  }
}

function offsetFor(side: Side, size: number): [number, number, number] {
  switch (side) {
    case "left":
      return [-size * 0.82, 0, 0];
    case "above":
      return [0, size * 0.85, 0];
    case "below":
      return [0, -size * 0.85, 0];
    default:
      return [size * 0.82, 0, 0];
  }
}

/** True when a screen point lies under one of the shell's overlays. */
export function underShell(x: number, y: number, width: number, height: number, narrow: boolean): boolean {
  if (narrow) return y < height * 0.24 || y > height * 0.47;
  if (x < width * 0.36 && y > 110) return true;
  if (x > width - 440) return true;
  return y > height - 170;
}

/** True when any corner of the box lies under a shell overlay. The overlays are large, so corners suffice. */
function rectUnderShell(rect: Rect, width: number, height: number, narrow: boolean): boolean {
  return (
    underShell(rect.left, rect.top, width, height, narrow) ||
    underShell(rect.right, rect.top, width, height, narrow) ||
    underShell(rect.left, rect.bottom, width, height, narrow) ||
    underShell(rect.right, rect.bottom, width, height, narrow)
  );
}

export function Labels() {
  const { layout, runtimeRef, hoverId } = useScene();
  const { focusedStarId, plan, view, narration } = useSignals();
  const [nearIds, setNearIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [sides, setSides] = useState<Record<string, Side>>({});
  const [warping, setWarping] = useState(false);
  const [compactLabels, setCompact] = useState(false);
  const nearKey = useRef("");
  const hiddenKey = useRef("");
  const sidesKey = useRef("");
  const accumulator = useRef(1);
  const lastDim = useRef(-1);
  const scratch = useRef(new Vector3());
  const camRight = useRef(new Vector3());
  const camUp = useRef(new Vector3());
  const groups = useRef(new Map<string, Group>());
  const shellActive = narration.length > 0 || view !== null;
  const shellRef = useRef(shellActive);
  useEffect(() => {
    shellRef.current = shellActive;
  }, [shellActive]);

  useFrame((state, delta) => {
    const rt = runtimeRef.current;
    const dim = rt.dim;
    if (Math.abs(dim - lastDim.current) > 0.01) {
      lastDim.current = dim;
      const root = state.gl.domElement.closest<HTMLElement>("[data-starmap]");
      root?.style.setProperty("--sm-dim", dim.toFixed(3));
    }
    // Star labels ride on the runtime positions every frame.
    const p = rt.positions;
    for (const [id, group] of groups.current) {
      const index = layout.indexById.get(id);
      if (index === undefined) continue;
      group.position.set(p[index * 3], p[index * 3 + 1], p[index * 3 + 2]);
    }

    accumulator.current += delta;
    if (accumulator.current < 0.15) return;
    accumulator.current = 0;

    // Constellation names wait for the intro to finish, then fade in together.
    const isWarping = rt.intro.phase !== "idle" && rt.intro.phase !== "done";
    setWarping((current) => (current === isWarping ? current : isWarping));

    const { width, height } = state.size;
    const narrow = width / Math.max(height, 1) < 0.9;
    const shell = shellRef.current;
    const cameraPosition = state.camera.position;
    const maxDistance = sceneTuning.labelDistance;
    const v = scratch.current;
    const staged = rt.view.kind !== null;
    // Phone-sized stages label with the name alone.
    const compact = narrow && staged;
    // A stage designs its label sides around its dressing; only the free
    // map lets a label flip to the other side of its star.
    const allowFlip = !staged;
    setCompact((current) => (current === compact ? current : compact));
    // Labels are billboarded, so their anchor sits off the star along the
    // camera's own right and up.
    camRight.current.set(1, 0, 0).applyQuaternion(state.camera.quaternion);
    camUp.current.set(0, 1, 0).applyQuaternion(state.camera.quaternion);
    const blocked = (rect: Rect) =>
      rect.left < 4 ||
      rect.right > width - 4 ||
      rect.top < 4 ||
      rect.bottom > height - 4 ||
      (shell && rectUnderShell(rect, width, height, narrow));
    const candidates: Candidate[] = [];
    for (const star of layout.stars) {
      const i = star.index;
      const visible = rt.lit[i] * rt.filter[i] > 0.5 && rt.emphasis[i] > 0.5;
      if (!visible) continue;
      v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      const wanted = rt.labelIds.has(star.id) || v.distanceTo(cameraPosition) < maxDistance;
      if (!wanted) continue;
      // The preferred side, or the opposite one when that would sit under
      // the shell or off screen.
      const preferred = rt.labelSides.get(star.id) ?? "right";
      const place = (side: Side): Rect | null => {
        const [ox, oy] = offsetFor(side, star.size);
        v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2])
          .addScaledVector(camRight.current, ox)
          .addScaledVector(camUp.current, oy)
          .project(state.camera);
        if (v.z > 1) return null;
        return labelRect(star, side, (v.x * 0.5 + 0.5) * width, (0.5 - v.y * 0.5) * height, compact);
      };
      const primary = place(preferred);
      const flipped = allowFlip ? place(FLIP[preferred]) : null;
      const primaryOk = primary !== null && !blocked(primary);
      const flippedOk = flipped !== null && !blocked(flipped);
      if (primaryOk) {
        candidates.push({
          star,
          side: preferred,
          rect: primary,
          alt: flippedOk ? { side: FLIP[preferred], rect: flipped } : null,
        });
      } else if (flippedOk) {
        candidates.push({ star, side: FLIP[preferred], rect: flipped, alt: null });
      }
    }
    const chosen = new Map<string, Side>();
    if (narrow && staged) {
      // A phone-sized stage labels its few most relevant stars, and only
      // where the boxes do not collide: cited stars first, then the
      // heaviest, then the most recent.
      const ranked = [...candidates].sort((a, b) => {
        const cited = rt.lock[b.star.index] - rt.lock[a.star.index];
        if (Math.abs(cited) > 0.01) return cited;
        if (a.star.weight !== b.star.weight) return b.star.weight - a.star.weight;
        return b.star.startRank - a.star.startRank;
      });
      const kept: Rect[] = [];
      for (const candidate of ranked) {
        if (chosen.size >= MOBILE_VIEW_LABELS) break;
        if (!kept.some((rect) => intersects(rect, candidate.rect))) {
          kept.push(candidate.rect);
          chosen.set(candidate.star.id, candidate.side);
        } else if (candidate.alt && !kept.some((rect) => intersects(rect, candidate.alt!.rect))) {
          kept.push(candidate.alt.rect);
          chosen.set(candidate.star.id, candidate.alt.side);
        }
      }
    } else {
      for (const candidate of candidates) chosen.set(candidate.star.id, candidate.side);
    }
    const ids = layout.stars.filter((star) => chosen.has(star.id)).map((star) => star.id);
    const key = ids.join("|");
    if (key !== nearKey.current) {
      nearKey.current = key;
      setNearIds(ids);
    }
    const sideEntries = [...chosen.entries()];
    const sideKey = sideEntries.map(([id, side]) => `${id}:${side}`).join("|");
    if (sideKey !== sidesKey.current) {
      sidesKey.current = sideKey;
      setSides(Object.fromEntries(sideEntries));
    }

    // Constellation label collision pass in screen space, plus the shell test.
    const projected: Projected[] = [];
    const hidden: string[] = [];
    for (const constellation of layout.constellations) {
      v.copy(constellation.labelPosition).project(state.camera);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (0.5 - v.y * 0.5) * height;
      if (shell && underShell(x, y, width, height, narrow)) {
        hidden.push(constellation.id);
        continue;
      }
      projected.push({
        id: constellation.id,
        x,
        y,
        z: v.z,
        halfWidth: (constellation.label.length * LABEL_PX_PER_CHAR) / 2,
      });
    }
    projected.sort((a, b) => a.z - b.z);
    for (let i = 0; i < projected.length; i++) {
      const a = projected[i];
      if (hidden.includes(a.id)) continue;
      for (let j = i + 1; j < projected.length; j++) {
        const b = projected[j];
        if (hidden.includes(b.id)) continue;
        const overlapX = Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth + 10;
        const overlapY = Math.abs(a.y - b.y) < LABEL_HEIGHT_PX + 6;
        if (overlapX && overlapY) hidden.push(b.id);
      }
    }
    const hiddenJoined = hidden.join("|");
    if (hiddenJoined !== hiddenKey.current) {
      hiddenKey.current = hiddenJoined;
      setHiddenIds(hidden);
    }
  });

  // The card names the constellation, so while a star is focused, a plan is
  // active or a view is staged every constellation label fades; at close
  // range the focused star's own label would land under the shell's title.
  const muted = focusedStarId !== null || plan !== null || view !== null;

  const visible = new Set<string>(nearIds);
  if (hoverId) visible.add(hoverId);
  if (focusedStarId) visible.delete(focusedStarId);

  return (
    <group>
      {layout.constellations.map((constellation) => {
        const hidden = hiddenIds.includes(constellation.id) || warping;
        const className = `sm-constellation${muted ? " sm-muted" : ""}${hidden ? " sm-hidden" : ""}`;
        return (
          <Html
            key={constellation.id}
            position={constellation.labelPosition}
            center
            zIndexRange={[8, 0]}
            pointerEvents="none"
            style={{ pointerEvents: "none" }}
          >
            <span className={className}>{constellation.label}</span>
          </Html>
        );
      })}
      {layout.stars
        .filter((star) => visible.has(star.id))
        .map((star) => {
          const side = sides[star.id] ?? "right";
          return (
            // The billboard keeps the label just outside the glow at any distance.
            <group
              key={star.id}
              position={star.position}
              ref={(group) => {
                if (group) groups.current.set(star.id, group);
                else groups.current.delete(star.id);
              }}
            >
              <Billboard>
                <Html
                  position={offsetFor(side, star.size)}
                  zIndexRange={[8, 0]}
                  pointerEvents="none"
                  style={{ pointerEvents: "none" }}
                >
                  <span className={`sm-star sm-side-${side}${compactLabels ? " sm-compact" : ""}`}>
                    <span className="sm-star-name">{star.label}</span>
                    {star.period && !compactLabels ? (
                      <span className="sm-star-period">{star.period}</span>
                    ) : null}
                  </span>
                </Html>
              </Billboard>
            </group>
          );
        })}
    </group>
  );
}
