"use client";

// The per-frame brain of the scene. It runs before every other frame callback
// and turns the flight signals into the runtime arrays every drawable reads:
// star positions, ignition, the year filter, view emphasis, citation locks,
// repo pulses and the beam list. It also owns the intro clock and calls
// finishIntro() when the warp-in ends.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { RepoPulse } from "@/lib/contract";
import { clamp01, damp, easeInOutCubic, easeOutCubic, moveToward, smoothstep } from "./motion";
import { useScene } from "./SceneContext";
import { useSignals, type FlightSignals } from "./signals";
import { sceneTuning } from "./tuning";
import { bandFor, buildStage, canonicalFrame, stagePose, toWorld, type Stage } from "./views";

export const STAGE_FRAME = canonicalFrame();

const TIMES = {
  desktop: { warpEnd: 2.4, igniteStart: 1.85, igniteEnd: 5.0, end: 5.9 },
  mobile: { warpEnd: 1.9, igniteStart: 1.5, igniteEnd: 4.2, end: 5.0 },
};

/** How long locked beams stay after the answer lands, seconds. */
const LOCK_HOLD = 1.4;

interface Tween {
  from: Float32Array;
  start: number;
  duration: number;
  stagger: number;
}

interface Local {
  introActive: boolean;
  viewKey: string;
  narrow: boolean | null;
  tween: Tween | null;
  emphasisTarget: Float32Array;
  beamsKey: string;
  lastAsking: boolean;
  landedAt: number;
  lockedAt: number;
  pulses: Record<string, RepoPulse> | null;
}

export function Choreographer() {
  const { layout, runtimeRef, reducedMotion, profile } = useScene();
  const signals = useSignals();
  const size = useThree((state) => state.size);
  const narrow = size.width / Math.max(size.height, 1) < 0.9;
  // The free band is portrait on wide screens and a strip on phones.
  const stage = useMemo(() => buildStage(signals.view, layout, !narrow), [signals.view, layout, narrow]);

  const signalsRef = useRef<FlightSignals>(signals);
  const stageRef = useRef<Stage | null>(stage);
  useEffect(() => {
    signalsRef.current = signals;
    stageRef.current = stage;
  }, [signals, stage]);

  // Reduced motion: no intro at all. The map is simply there.
  const { intro, finishIntro } = signals;
  useEffect(() => {
    if (reducedMotion && intro === "playing") finishIntro();
  }, [reducedMotion, intro, finishIntro]);

  const local = useRef<Local>({
    introActive: false,
    viewKey: "",
    narrow: null,
    tween: null,
    emphasisTarget: new Float32Array(layout.stars.length).fill(1),
    beamsKey: "",
    lastAsking: false,
    landedAt: -1e9,
    lockedAt: -1,
    pulses: null,
  });
  const scratch = useMemo(
    () => ({ v: new Vector3(), forward: new Vector3(), up: new Vector3() }),
    [],
  );

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const rt = runtimeRef.current;
    const s = signalsRef.current;
    const L = local.current;
    const n = layout.stars.length;
    const now = state.clock.elapsedTime;
    const aspect = state.size.width / Math.max(state.size.height, 1);
    const narrowNow = aspect < 0.9;

    // ------------------------------------------------------------ intro
    const intro = rt.intro;
    const times = profile.mobile ? TIMES.mobile : TIMES.desktop;
    const scale = sceneTuning.introDurationScale;
    if (s.intro === "playing" && !L.introActive && !reducedMotion) {
      L.introActive = true;
      intro.phase = "warp";
      intro.t = 0;
      intro.warp = 0;
      intro.travel = 0;
      intro.surge = 0;
      intro.year = 2020;
      intro.yearAlpha = 0;
      intro.litCount = 0;
      intro.skipped = false;
      intro.run += 1;
      rt.lit.fill(0);
      rt.ignite.fill(-1);
    }
    if (L.introActive) {
      if (s.intro !== "playing") {
        // Skipped, or finished by us a frame ago. Cut cleanly to the lit map.
        L.introActive = false;
        intro.skipped = intro.phase !== "done";
        intro.phase = "done";
        intro.warp = 0;
        intro.travel = 1;
        intro.surge = 0;
        intro.yearAlpha = 0;
        rt.lit.fill(1);
        for (let i = 0; i < n; i++) rt.ignite[i] = Math.max(rt.ignite[i], 2);
      } else {
        intro.t += dt;
        const t = intro.t / scale;
        intro.warp = smoothstep(0, 0.45, t) * (1 - smoothstep(times.warpEnd - 0.9, times.warpEnd, t));
        intro.travel = 1 - Math.pow(1 - clamp01(t / times.warpEnd), 3.3);
        intro.surge = intro.warp;
        const window = times.igniteEnd - times.igniteStart - 0.35;
        let year = 2020;
        let count = 0;
        for (let i = 0; i < n; i++) {
          const star = layout.stars[i];
          const at = times.igniteStart + (star.startRank / Math.max(n - 1, 1)) * window;
          if (rt.ignite[i] < 0 && t >= at) {
            rt.ignite[i] = 0;
            rt.flash += 0.1;
          }
          if (rt.ignite[i] >= 0) {
            rt.ignite[i] += dt / scale;
            rt.lit[i] = easeOutCubic(clamp01(rt.ignite[i] / 0.35));
            count += 1;
            if (star.start) year = Math.max(year, star.start.year);
          }
        }
        intro.litCount = count;
        intro.year = year;
        intro.yearAlpha =
          smoothstep(times.igniteStart - 0.35, times.igniteStart + 0.25, t) *
          (1 - smoothstep(times.igniteEnd + 0.1, times.end - 0.15, t));
        if (t < times.warpEnd) intro.phase = "warp";
        else if (t < times.igniteEnd) intro.phase = "ignite";
        else if (t < times.end) intro.phase = "settle";
        else {
          intro.phase = "done";
          intro.travel = 1;
          L.introActive = false;
          rt.lit.fill(1);
          s.finishIntro();
        }
      }
    }

    // ------------------------------------------------------------ views
    const stageNow = stageRef.current;
    const key = stageNow ? stageNow.key : "";
    if (key !== L.viewKey || L.narrow !== narrowNow) {
      L.viewKey = key;
      L.narrow = narrowNow;
      const v = scratch.v;
      for (let i = 0; i < n; i++) {
        const star = layout.stars[i];
        const slot = stageNow?.slotByIndex.get(i);
        if (slot) {
          toWorld(STAGE_FRAME, slot.x, slot.y, slot.z, v);
          L.emphasisTarget[i] = 1;
        } else if (stageNow) {
          // Recede: flatten onto a backdrop plane well behind the stage.
          const along = star.position.dot(STAGE_FRAME.camDir);
          v.copy(star.position)
            .addScaledVector(STAGE_FRAME.camDir, -along)
            .multiplyScalar(1.4)
            .addScaledVector(STAGE_FRAME.camDir, -(36 + 16 * star.seed));
          L.emphasisTarget[i] = 0.1;
        } else {
          v.copy(star.position);
          L.emphasisTarget[i] = 1;
        }
        rt.targets[i * 3] = v.x;
        rt.targets[i * 3 + 1] = v.y;
        rt.targets[i * 3 + 2] = v.z;
      }
      const seconds = (s.tour.active ? 1.8 : 1.5) * sceneTuning.flightDurationScale;
      L.tween = {
        from: rt.positions.slice(),
        start: now + (reducedMotion ? 0.2 : 0),
        duration: reducedMotion ? 0 : seconds,
        stagger: reducedMotion ? 0 : 0.035,
      };
      rt.view.key = key;
      rt.view.kind = stageNow?.kind ?? null;
      rt.view.progress = 0;
      rt.view.pose = stageNow
        ? stagePose(stageNow, STAGE_FRAME, narrowNow ? 70 : 50, aspect, bandFor(narrowNow))
        : null;
      rt.view.run += 1;
      rt.labelIds = new Set(stageNow?.labelIds ?? []);
      rt.labelSides = new Map(
        stageNow ? stageNow.slots.map((slot) => [layout.stars[slot.index].id, slot.side]) : [],
      );
    }
    const tween = L.tween;
    if (tween) {
      const elapsed = now - tween.start;
      if (elapsed < 0) {
        rt.moving = false;
      } else {
        let allDone = true;
        for (let i = 0; i < n; i++) {
          const u =
            tween.duration <= 0
              ? 1
              : clamp01((elapsed - (i % 7) * tween.stagger) / tween.duration);
          if (u < 1) allDone = false;
          const e = easeInOutCubic(u);
          for (let k = 0; k < 3; k++) {
            const j = i * 3 + k;
            rt.positions[j] = tween.from[j] + (rt.targets[j] - tween.from[j]) * e;
          }
        }
        rt.moving = true;
        rt.view.progress =
          tween.duration <= 0 ? 1 : clamp01(elapsed / (tween.duration + 6 * tween.stagger));
        if (allDone) {
          L.tween = null;
          rt.view.progress = 1;
        }
      }
    } else {
      rt.moving = false;
    }
    for (let i = 0; i < n; i++) {
      rt.emphasis[i] = reducedMotion
        ? L.emphasisTarget[i]
        : damp(rt.emphasis[i], L.emphasisTarget[i], 3.2, dt);
    }

    // ------------------------------------------------------------ year filter
    const [y0, y1] = s.yearRange;
    for (let i = 0; i < n; i++) {
      const start = layout.stars[i].start;
      const target = !start || (start.year >= y0 && start.year <= y1) ? 1 : 0;
      rt.filter[i] = reducedMotion ? target : moveToward(rt.filter[i], target, 2.5, dt);
    }

    // ------------------------------------------------------------ beams and locks
    const asking = s.status === "asking";
    const wasAsking = L.lastAsking;
    if (asking && !wasAsking) {
      rt.beams.length = 0;
      L.beamsKey = "";
      L.lockedAt = -1;
    }
    if (!asking && wasAsking) L.landedAt = now;
    L.lastAsking = asking;

    const cited = new Set<number>();
    for (const sentence of s.narration) {
      for (const citation of sentence.citations) {
        const index = layout.indexById.get(citation.starId);
        if (index !== undefined) cited.add(index);
      }
    }
    const locked = s.narration.length > 0;
    const listed = new Set<number>();
    for (const id of s.beams) {
      const index = layout.indexById.get(id);
      if (index !== undefined) listed.add(index);
    }
    if (asking && !reducedMotion) {
      const beamsKey = s.beams.join("|");
      if (beamsKey !== L.beamsKey) {
        L.beamsKey = beamsKey;
        let order = 0;
        for (const id of s.beams) {
          const index = layout.indexById.get(id);
          if (index === undefined) continue;
          if (rt.beams.some((b) => b.index === index && !b.dying)) continue;
          rt.beams.push({
            index,
            alpha: 0,
            lock: 0,
            reach: 0,
            seed: (index * 0.6180339887) % 1,
            age: -order * 0.09,
            dying: false,
          });
          order += 1;
        }
      }
    }
    let flashBump = 0;
    if (locked && L.lockedAt < 0 && rt.beams.length > 0) {
      L.lockedAt = now;
      flashBump = 0.5;
    }
    for (let b = 0; b < rt.beams.length; b++) {
      const beam = rt.beams[b];
      beam.age += dt;
      if (beam.age < 0) continue;
      const isCited = cited.has(beam.index);
      // The provider empties `beams` in the same batch that lands the first
      // sentence, so after landing a beam lives on its citation alone: cited
      // beams lock and hold briefly, the rest fade.
      const wanted = asking
        ? listed.has(beam.index) && (!locked || isCited)
        : locked && isCited && now - L.landedAt < LOCK_HOLD;
      if (!wanted) beam.dying = true;
      if (beam.dying) {
        beam.alpha = moveToward(beam.alpha, 0, 1 / 0.6, dt);
        continue;
      }
      beam.alpha = moveToward(beam.alpha, 1, 1 / 0.25, dt);
      beam.reach = easeOutCubic(clamp01(beam.age / 0.55));
      beam.lock = moveToward(beam.lock, locked && isCited ? 1 : 0, 1 / 0.3, dt);
    }
    for (let i = rt.beams.length - 1; i >= 0; i--) {
      const beam = rt.beams[i];
      if (beam.dying && beam.alpha <= 0) rt.beams.splice(i, 1);
    }
    const camera = state.camera;
    camera.getWorldDirection(scratch.forward);
    scratch.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    rt.beamOrigin
      .copy(camera.position)
      .addScaledVector(scratch.forward, 3.2)
      .addScaledVector(scratch.up, narrowNow ? -1.5 : -1.05);
    const fresh = asking || now - L.landedAt < LOCK_HOLD;
    for (let i = 0; i < n; i++) {
      const target = locked && cited.has(i) ? (fresh ? 1 : 0.55) : 0;
      rt.lock[i] = reducedMotion ? target : damp(rt.lock[i], target, 6, dt);
    }

    // ------------------------------------------------------------ pulses
    if (s.pulses !== L.pulses) {
      L.pulses = s.pulses;
      rt.pulse.fill(0);
      const entries = Object.values(s.pulses).filter(
        (p) => p.pushesLast30d > 0 && layout.indexById.has(p.starId),
      );
      let newest = -Infinity;
      for (const p of entries) {
        const at = p.lastPushAt ? Date.parse(p.lastPushAt) : NaN;
        if (Number.isFinite(at)) newest = Math.max(newest, at);
      }
      for (const p of entries) {
        const index = layout.indexById.get(p.starId)!;
        const at = p.lastPushAt ? Date.parse(p.lastPushAt) : NaN;
        let recency = 0.35;
        if (Number.isFinite(at) && Number.isFinite(newest)) {
          recency = at >= newest ? 1 : clamp01(1 - (newest - at) / (30 * 86400000)) * 0.7;
        }
        rt.pulse[index] = 0.4 + 0.6 * recency;
      }
    }

    rt.tour = s.tour.active;
    rt.flash = (rt.flash + flashBump) * Math.exp(-dt * 4.5);
  }, -10);

  return null;
}
