"use client";

// DOM labels through drei's Html: crisp at any pixel ratio and outside the
// bloom pass. Constellation names show softly in the overview and fade to
// almost nothing while a star is focused or a plan is active, except the
// focused star's own constellation. Two constellation labels that would
// overlap on screen resolve by hiding the farther one. Star names show on
// hover or when the camera is close; the focused star's name is left to the
// card. The visible sets are recomputed a few times a second and only
// committed when they change.

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import { Vector3 } from "three";
import { useFlight } from "@/lib/flight-state";
import { useScene } from "./SceneContext";
import { sceneTuning } from "./tuning";

const LABEL_PX_PER_CHAR = 8.6;
const LABEL_HEIGHT_PX = 14;

interface Projected {
  id: string;
  x: number;
  y: number;
  z: number;
  halfWidth: number;
}

export function Labels() {
  const { layout, runtimeRef, hoverId } = useScene();
  const { focusedStarId, plan } = useFlight();
  const [nearIds, setNearIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const nearKey = useRef("");
  const hiddenKey = useRef("");
  const accumulator = useRef(1);
  const lastDim = useRef(-1);
  const scratch = useRef(new Vector3());

  useFrame((state, delta) => {
    const dim = runtimeRef.current.dim;
    if (Math.abs(dim - lastDim.current) > 0.01) {
      lastDim.current = dim;
      state.gl.domElement.parentElement?.style.setProperty("--sm-dim", dim.toFixed(3));
    }
    accumulator.current += delta;
    if (accumulator.current < 0.15) return;
    accumulator.current = 0;

    const cameraPosition = state.camera.position;
    const maxDistance = sceneTuning.labelDistance;
    const ids: string[] = [];
    for (const star of layout.stars) {
      if (star.position.distanceTo(cameraPosition) < maxDistance) ids.push(star.id);
    }
    const key = ids.join("|");
    if (key !== nearKey.current) {
      nearKey.current = key;
      setNearIds(ids);
    }

    // Constellation label collision pass in screen space.
    const { width, height } = state.size;
    const projected: Projected[] = [];
    const v = scratch.current;
    for (const constellation of layout.constellations) {
      v.copy(constellation.labelPosition).project(state.camera);
      if (v.z > 1) continue;
      projected.push({
        id: constellation.id,
        x: (v.x * 0.5 + 0.5) * width,
        y: (0.5 - v.y * 0.5) * height,
        z: v.z,
        halfWidth: (constellation.label.length * LABEL_PX_PER_CHAR) / 2,
      });
    }
    projected.sort((a, b) => a.z - b.z);
    const hidden: string[] = [];
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

  // The card names the constellation, so while a star is focused or a plan
  // is active every constellation label fades; at close range the focused
  // star's own label would land under the shell's title or prompt.
  const muted = focusedStarId !== null || plan !== null;

  const visible = new Set<string>(nearIds);
  if (hoverId) visible.add(hoverId);
  if (focusedStarId) visible.delete(focusedStarId);

  return (
    <group>
      {layout.constellations.map((constellation) => {
        const hidden = hiddenIds.includes(constellation.id);
        const className = `sm-constellation${muted ? " sm-muted" : ""}${hidden ? " sm-hidden" : ""}`;
        return (
          <Html
            key={constellation.id}
            position={constellation.labelPosition}
            center
            zIndexRange={[2, 1]}
            pointerEvents="none"
            style={{ pointerEvents: "none" }}
          >
            <span className={className}>{constellation.label}</span>
          </Html>
        );
      })}
      {layout.stars
        .filter((star) => visible.has(star.id))
        .map((star) => (
          // The billboard keeps the label just outside the glow, to the
          // star's screen-right, at any distance.
          <Billboard key={star.id} position={star.position}>
            <Html
              position={[star.size * 0.82, 0, 0]}
              zIndexRange={[3, 1]}
              pointerEvents="none"
              style={{ pointerEvents: "none" }}
            >
              <span className="sm-star">
                <span className="sm-star-name">{star.label}</span>
                {star.period ? <span className="sm-star-period">{star.period}</span> : null}
              </span>
            </Html>
          </Billboard>
        ))}
    </group>
  );
}
