"use client";

// During a multi-stop plan, a faint dashed curve joins the stops in order and
// a small numbered marker sits on each one.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html, Line } from "@react-three/drei";
import { CatmullRomCurve3, type Vector3 } from "three";
import { useFlight } from "@/lib/flight-state";
import { useScene } from "./SceneContext";

interface DashedLine {
  material: { dashOffset: number };
}

export function PlanPath() {
  const { layout, profile, reducedMotion } = useScene();
  const { plan, stopIndex } = useFlight();
  const lineRef = useRef<DashedLine>(null);

  const stops = useMemo(() => {
    if (!plan || plan.stops.length < 2) return null;
    const list: { starId: string; position: Vector3; size: number; index: number }[] = [];
    plan.stops.forEach((stop, index) => {
      const starIndex = layout.indexById.get(stop.starId);
      if (starIndex === undefined) return;
      const star = layout.stars[starIndex];
      list.push({ starId: stop.starId, position: star.position, size: star.size, index });
    });
    return list.length >= 2 ? list : null;
  }, [plan, layout]);

  const points = useMemo(() => {
    if (!stops) return null;
    const unique: Vector3[] = [];
    for (const stop of stops) {
      const last = unique[unique.length - 1];
      if (last && last.distanceTo(stop.position) < 0.01) continue;
      unique.push(stop.position);
    }
    if (unique.length < 2) return null;
    const curve = new CatmullRomCurve3(unique, false, "centripetal", 0.5);
    return curve.getPoints(28 * (unique.length - 1));
  }, [stops]);

  useFrame((_, delta) => {
    const line = lineRef.current;
    if (line && !reducedMotion) line.material.dashOffset -= Math.min(delta, 0.05) * 1.1;
  });

  if (!stops || !points) return null;

  return (
    <group>
      <Line
        ref={lineRef as never}
        points={points}
        color="#f2c76b"
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
        <Billboard key={`${stop.index}-${stop.starId}`} position={stop.position}>
          <Html
            position={[-stop.size * (profile.mobile ? 1.05 : 0.8), 0, 0]}
            zIndexRange={[3, 1]}
            pointerEvents="none"
            style={{ pointerEvents: "none" }}
          >
            <span
              className={`sm-stop${stop.index === stopIndex ? " sm-stop-current" : ""}`}
            >
              {stop.index + 1}
            </span>
          </Html>
        </Billboard>
      ))}
    </group>
  );
}
