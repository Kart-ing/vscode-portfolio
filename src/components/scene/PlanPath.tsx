"use client";

// During a multi-stop plan, a faint dashed curve joins the stops in order and
// a small numbered marker sits on each one. Both follow the runtime positions,
// so the path re-threads itself while a staged view moves the stars.

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html, Line } from "@react-three/drei";
import { CatmullRomCurve3, Group, Vector3 } from "three";
import { underShell } from "./Labels";
import { useScene } from "./SceneContext";
import { useSignals } from "./signals";
import { ACCENT } from "./tuning";

interface DashedLine {
  material: { dashOffset: number };
}

interface Stop {
  starId: string;
  index: number;
  starIndex: number;
  size: number;
}

function curveThrough(stops: Stop[], positions: Float32Array): Vector3[] | null {
  const unique: Vector3[] = [];
  for (const stop of stops) {
    const v = new Vector3(
      positions[stop.starIndex * 3],
      positions[stop.starIndex * 3 + 1],
      positions[stop.starIndex * 3 + 2],
    );
    const last = unique[unique.length - 1];
    if (last && last.distanceTo(v) < 0.01) continue;
    unique.push(v);
  }
  if (unique.length < 2) return null;
  const curve = new CatmullRomCurve3(unique, false, "centripetal", 0.5);
  return curve.getPoints(28 * (unique.length - 1));
}

export function PlanPath() {
  const { layout, profile, reducedMotion, runtimeRef } = useScene();
  const { plan, stopIndex, narration, view } = useSignals();
  const lineRef = useRef<DashedLine>(null);
  const groups = useRef(new Map<number, Group>());
  const [points, setPoints] = useState<Vector3[] | null>(null);
  // Badges that would sit under the shell's narration, card, prompt or sheet.
  const [hiddenStops, setHiddenStops] = useState<number[]>([]);
  const hiddenKey = useRef("");
  const shellTimer = useRef(1);
  const throttle = useRef(0);
  const stopsRef = useRef<Stop[] | null>(null);
  const threaded = useRef<Stop[] | null>(null);
  const scratch = useRef(new Vector3());
  const shellActive = narration.length > 0 || view !== null;
  const shellRef = useRef(shellActive);
  useEffect(() => {
    shellRef.current = shellActive;
  }, [shellActive]);

  const stops = useMemo(() => {
    if (!plan || plan.stops.length < 2) return null;
    const list: Stop[] = [];
    plan.stops.forEach((stop, index) => {
      const starIndex = layout.indexById.get(stop.starId);
      if (starIndex === undefined) return;
      list.push({ starId: stop.starId, index, starIndex, size: layout.stars[starIndex].size });
    });
    return list.length >= 2 ? list : null;
  }, [plan, layout]);

  useEffect(() => {
    stopsRef.current = stops;
  }, [stops]);

  useFrame((state, delta) => {
    const rt = runtimeRef.current;
    const line = lineRef.current;
    if (line && !reducedMotion) line.material.dashOffset -= Math.min(delta, 0.05) * 1.1;
    const p = rt.positions;
    for (const [starIndex, group] of groups.current) {
      group.position.set(p[starIndex * 3], p[starIndex * 3 + 1], p[starIndex * 3 + 2]);
    }
    // A few times a second, withhold badges that project under the shell.
    shellTimer.current += delta;
    if (shellTimer.current > 0.15) {
      shellTimer.current = 0;
      const hidden: number[] = [];
      const current = stopsRef.current;
      if (current && shellRef.current) {
        const { width, height } = state.size;
        const narrow = width / Math.max(height, 1) < 0.9;
        const v = scratch.current;
        for (const stop of current) {
          const i = stop.starIndex;
          v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).project(state.camera);
          const x = (v.x * 0.5 + 0.5) * width;
          const y = (0.5 - v.y * 0.5) * height;
          if (v.z > 1 || underShell(x, y, width, height, narrow)) hidden.push(stop.index);
        }
      }
      const key = hidden.join("|");
      if (key !== hiddenKey.current) {
        hiddenKey.current = key;
        setHiddenStops(hidden);
      }
    }
    // Thread the curve through the current positions: on a new plan, a few
    // times a second while the stars travel, and once more when they settle.
    const current = stopsRef.current;
    let rethread = current !== threaded.current;
    if (current && rt.moving) {
      throttle.current += delta;
      if (throttle.current > 0.05) rethread = true;
    } else if (throttle.current !== 0) {
      rethread = true;
    }
    if (rethread) {
      throttle.current = 0;
      threaded.current = current;
      setPoints(current ? curveThrough(current, p) : null);
    }
  });

  if (!stops || !points) return null;

  return (
    <group>
      <Line
        ref={lineRef as never}
        points={points}
        color={ACCENT}
        lineWidth={1.2}
        dashed
        dashSize={0.8}
        gapSize={0.5}
        transparent
        opacity={0.32}
        depthWrite={false}
        renderOrder={4}
      />
      {stops.map((stop) => (
        // Billboarded so the badge sits just left of the glow at any distance.
        <group
          key={`${stop.index}-${stop.starId}`}
          ref={(group) => {
            if (group) groups.current.set(stop.starIndex, group);
            else groups.current.delete(stop.starIndex);
          }}
        >
          <Billboard>
            <Html
              position={[-stop.size * (profile.mobile ? 1.05 : 0.8), 0, 0]}
              zIndexRange={[8, 0]}
              pointerEvents="none"
              style={{ pointerEvents: "none" }}
            >
              <span
                className={`sm-stop${stop.index === stopIndex ? " sm-stop-current" : ""}${
                  hiddenStops.includes(stop.index) ? " sm-stop-hidden" : ""
                }`}
              >
                {stop.index + 1}
              </span>
            </Html>
          </Billboard>
        </group>
      ))}
    </group>
  );
}
