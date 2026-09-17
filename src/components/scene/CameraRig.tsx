"use client";

// Owns the camera. In the overview it hands control to damped OrbitControls
// with a slow auto-orbit. When the focused star changes it disables the
// controls and flies along a raised quadratic curve to a pose that frames the
// star left of centre (wide screens) or in the upper half (narrow screens),
// then hands control back with the new orbit target. During the intro it
// rushes in from far behind the overview; during a staged view it frames the
// stage; on the tour every flight is slower, wider and gently rolled, and the
// camera drifts around the held star.

import { useMemo, useRef, type ComponentRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MathUtils, Matrix4, PerspectiveCamera, Vector3 } from "three";
import { STAGE_FRAME } from "./Choreographer";
import type { StarNode } from "./layout";
import { damp, easeInOutCubic } from "./motion";
import { useScene, type Pose } from "./SceneContext";
import { useSignals } from "./signals";
import { sceneTuning } from "./tuning";

type Controls = ComponentRef<typeof OrbitControls>;
type FlightKind = "arrive" | "star" | "overview" | "view";

interface Flight {
  from: Vector3;
  control: Vector3;
  to: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
  duration: number;
  elapsed: number;
  kind: FlightKind;
  /** Peak roll in radians, for the tour's cinematic arcs. */
  roll: number;
}

interface PendingCut {
  pose: Pose;
  kind: FlightKind;
  wait: number;
}

const UP = new Vector3(0, 1, 0);
const UNSET = Symbol("unset");

function bezier(out: Vector3, a: Vector3, b: Vector3, c: Vector3, t: number): Vector3 {
  const mt = 1 - t;
  const wa = mt * mt;
  const wb = 2 * mt * t;
  const wc = t * t;
  return out.set(
    wa * a.x + wb * b.x + wc * c.x,
    wa * a.y + wb * b.y + wc * c.y,
    wa * a.z + wb * b.z + wc * c.z,
  );
}

/** Camera distance at which the whole arrangement fits the viewport. */
function fitDistance(layoutRadius: number, fov: number, aspect: number, narrow: boolean): number {
  const elevation = sceneTuning.overviewElevation;
  const tanV = Math.tan(MathUtils.degToRad(fov) / 2);
  const tanH = tanV * aspect;
  // The near edge of the disk is closer than the target, so fit that edge.
  const nearEdge = layoutRadius * Math.cos(elevation);
  const horizontal = (layoutRadius * 1.04) / tanH + nearEdge;
  const vertical = (layoutRadius * Math.sin(elevation) + 5) / tanV + nearEdge * 0.6;
  const margin = narrow ? 1.0 : sceneTuning.overviewMargin;
  return Math.max(horizontal, vertical) * margin;
}

function overviewPose(
  cameraPosition: Vector3,
  layoutRadius: number,
  fov: number,
  aspect: number,
  narrow: boolean,
  radiusScale = 1,
): Pose {
  const azimuth = Math.atan2(cameraPosition.x, cameraPosition.z);
  const radius = fitDistance(layoutRadius, fov, aspect, narrow) * radiusScale;
  const elevation = sceneTuning.overviewElevation;
  // The shell keeps its title at the top and the prompt at the bottom; the
  // map sits in the band between them, centred.
  const target = new Vector3(0, narrow ? -1 : 0, 0);
  return {
    position: new Vector3(
      Math.sin(azimuth) * Math.cos(elevation) * radius,
      Math.sin(elevation) * radius,
      Math.cos(azimuth) * Math.cos(elevation) * radius,
    ).add(target),
    target,
  };
}

function focusPose(
  star: StarNode,
  at: Vector3,
  cameraPosition: Vector3,
  fov: number,
  aspect: number,
  narrow: boolean,
  stageDir: Vector3 | null,
): Pose {
  const S = at;
  const distance = (narrow ? 7 : 4.5) + star.size * (narrow ? 9 : 7.5);
  // Approach from roughly where the camera is, pulled toward a canonical
  // direction: inward across the disk from slightly above it, or, inside a
  // staged view, the direction the stage faces so its arrangement stays legible.
  const fromCamera = new Vector3().subVectors(cameraPosition, S);
  const fromCameraDir =
    fromCamera.lengthSq() > 1e-4 ? fromCamera.normalize() : new Vector3(0, 0.5, 1).normalize();
  const outward = new Vector3(S.x, 0, S.z);
  const outwardDir = outward.lengthSq() > 1 ? outward.normalize() : new Vector3(0, 0, 1);
  const canonical = stageDir
    ? stageDir.clone().add(new Vector3(0, 0.18, 0)).normalize()
    : outwardDir.multiplyScalar(0.6).add(new Vector3(0, 0.62, 0)).normalize();
  const pull = stageDir ? 0.8 : 0.58;
  const dir = fromCameraDir.multiplyScalar(1 - pull).add(canonical.multiplyScalar(pull)).normalize();
  const minUp = stageDir ? 0.12 : 0.3;
  if (dir.y < minUp) {
    dir.y = minUp;
    dir.normalize();
  }
  const basis = new Matrix4().lookAt(
    dir.clone().multiplyScalar(distance),
    new Vector3(0, 0, 0),
    UP,
  );
  const right = new Vector3().setFromMatrixColumn(basis, 0);
  const up = new Vector3().setFromMatrixColumn(basis, 1);
  const tanHalf = Math.tan(MathUtils.degToRad(fov) / 2);
  // Wide: 53% across and 55% down, in the band between the narration column
  // (left) and the card (right), clear of the title block (top) and the
  // prompt and chips (bottom). Narrow: centred, 42% down, above the sheet.
  const ndcX = narrow ? 0 : 0.06;
  const ndcY = narrow ? 0.16 : -0.1;
  const target = S.clone()
    .sub(right.multiplyScalar(ndcX * distance * tanHalf * aspect))
    .sub(up.multiplyScalar(ndcY * distance * tanHalf));
  return { position: target.clone().add(dir.multiplyScalar(distance)), target };
}

export function CameraRig() {
  const { layout, runtimeRef, reducedMotion, profile } = useScene();
  const { focusedStarId } = useSignals();
  const controlsRef = useRef<Controls>(null);
  const flightRef = useRef<Flight | null>(null);
  const pendingCut = useRef<PendingCut | null>(null);
  const lastFocus = useRef<string | null | typeof UNSET>(UNSET);
  const lookTarget = useRef(new Vector3());
  const local = useRef({
    introRun: 0,
    viewRun: 0,
    warping: false,
    warpFrom: new Vector3(),
    warpTo: null as Pose | null,
    orbitDirection: 1,
  });
  const starAt = useMemo(() => new Vector3(), []);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const camera = state.camera as PerspectiveCamera;
    const controls = controlsRef.current;
    const rt = runtimeRef.current;
    const L = local.current;
    const aspect = state.size.width / Math.max(state.size.height, 1);
    const narrow = aspect < 0.9;
    const baseFov = narrow ? 70 : 50;
    if (!flightRef.current && !L.warping && Math.abs(camera.fov - baseFov) > 0.01) {
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
    }
    const overview = () => overviewPose(camera.position, layout.radius, baseFov, aspect, narrow);
    const focusPoseAt = (index: number) => {
      starAt.set(rt.targets[index * 3], rt.targets[index * 3 + 1], rt.targets[index * 3 + 2]);
      const stageDir = rt.view.pose ? STAGE_FRAME.camDir : null;
      return focusPose(layout.stars[index], starAt, camera.position, baseFov, aspect, narrow, stageDir);
    };

    const applyPose = (pose: Pose, kind: FlightKind) => {
      camera.up.copy(UP);
      camera.position.copy(pose.position);
      lookTarget.current.copy(pose.target);
      camera.lookAt(pose.target);
      if (controls) {
        controls.target.copy(pose.target);
        controls.enabled = true;
        controls.autoRotate = kind !== "star" && kind !== "view" && !reducedMotion;
        controls.autoRotateSpeed = 0.32;
        controls.update();
      }
      rt.flying = false;
      rt.flightProgress = 1;
      rt.landed = kind === "star";
    };

    const beginFlight = (pose: Pose, kind: FlightKind, secondsOverride?: number) => {
      const from = camera.position.clone();
      const fromTarget = (
        flightRef.current || !controls ? lookTarget.current : controls.target
      ).clone();
      const distance = from.distanceTo(pose.position);
      const tour = rt.tour && !reducedMotion;
      const base =
        kind === "arrive"
          ? 2.8
          : kind === "view"
            ? 1.5
            : MathUtils.clamp(1.4 + (0.6 * (distance - 8)) / 50, 1.4, 2.0);
      const seconds = secondsOverride ?? base * (tour ? 1.7 : 1);
      const mid = from.clone().lerp(pose.position, 0.5);
      const travel = pose.position.clone().sub(from);
      const side = new Vector3().crossVectors(travel, UP);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      const lift = kind === "arrive" ? 0.06 : tour ? 0.34 : 0.22;
      const sway = tour ? 0.16 : 0.08;
      const control = mid
        .add(UP.clone().multiplyScalar(distance * lift))
        .add(side.multiplyScalar(distance * sway));
      if (controls) {
        controls.enabled = false;
        controls.autoRotate = false;
      }
      rt.flying = true;
      rt.landed = false;
      rt.flightProgress = 0;
      flightRef.current = {
        from,
        control,
        to: pose.position,
        fromTarget,
        toTarget: pose.target,
        duration: seconds * sceneTuning.flightDurationScale,
        elapsed: 0,
        kind,
        roll: tour && kind !== "arrive" ? 0.06 : 0,
      };
    };

    const requestMove = (pose: Pose, kind: FlightKind) => {
      if (!reducedMotion) {
        beginFlight(pose, kind);
        return;
      }
      // Reduced motion: a quick fade to black, an instant cut, a fade back.
      if (kind === "arrive") {
        applyPose(pose, kind);
        return;
      }
      state.gl.domElement.style.opacity = "0";
      pendingCut.current = { pose, kind, wait: 0.18 };
    };

    // ---- Intro warp: rush in from far behind the overview.
    if (rt.intro.run !== L.introRun) {
      L.introRun = rt.intro.run;
      const pose = overview();
      const dir = pose.position.clone().sub(pose.target).normalize();
      L.warpFrom.copy(pose.position).addScaledVector(dir, layout.radius * (profile.mobile ? 4.5 : 5.5));
      L.warpTo = pose;
      L.warping = true;
      flightRef.current = null;
      pendingCut.current = null;
      state.gl.domElement.style.opacity = "1";
      if (controls) {
        controls.enabled = false;
        controls.autoRotate = false;
      }
      if (lastFocus.current === UNSET) lastFocus.current = null;
      rt.flying = true;
      rt.landed = false;
    }
    if (L.warping && L.warpTo) {
      const intro = rt.intro;
      if (intro.phase === "done") {
        L.warping = false;
        camera.fov = baseFov;
        camera.updateProjectionMatrix();
        if (intro.skipped) {
          intro.skipped = false;
          camera.up.copy(UP);
          beginFlight(L.warpTo, "overview", 0.7);
        } else {
          applyPose(L.warpTo, "overview");
        }
      } else {
        const travel = intro.travel;
        camera.position.lerpVectors(L.warpFrom, L.warpTo.position, travel);
        lookTarget.current.copy(L.warpTo.target);
        const roll = reducedMotion ? 0 : Math.sin(travel * Math.PI) * (profile.mobile ? 0.025 : 0.05);
        camera.up.set(Math.sin(roll), Math.cos(roll), 0);
        camera.lookAt(lookTarget.current);
        camera.fov = baseFov + intro.warp * (profile.mobile ? 14 : 26);
        camera.updateProjectionMatrix();
        rt.flying = travel < 1;
        rt.flightProgress = travel;
        if (travel >= 1 && intro.phase !== "warp") {
          L.warping = false;
          camera.fov = baseFov;
          camera.updateProjectionMatrix();
          applyPose(L.warpTo, "overview");
        } else {
          rt.dim = damp(rt.dim, 0, 3.5, delta);
          return;
        }
      }
    }

    // ---- First frame without an intro: the arrival.
    if (lastFocus.current === UNSET) {
      lastFocus.current = null;
      const pose = overview();
      if (reducedMotion) {
        applyPose(pose, "arrive");
      } else {
        const start = overviewPose(camera.position, layout.radius, baseFov, aspect, narrow, 1.45);
        start.position.y += 14;
        camera.position.copy(start.position);
        camera.lookAt(start.target);
        lookTarget.current.copy(start.target);
        beginFlight(pose, "arrive");
      }
    }

    // ---- A staged view began or ended: frame the stage, or go back.
    if (rt.view.run !== L.viewRun) {
      L.viewRun = rt.view.run;
      if (rt.view.pose) requestMove(rt.view.pose, "view");
      else if (rt.focusIndex >= 0) requestMove(focusPoseAt(rt.focusIndex), "star");
      else requestMove(overview(), "overview");
    }

    // ---- Focus changes.
    if (focusedStarId !== lastFocus.current) {
      lastFocus.current = focusedStarId;
      const index = focusedStarId ? (layout.indexById.get(focusedStarId) ?? -1) : -1;
      rt.focusIndex = index;
      L.orbitDirection = -L.orbitDirection;
      if (index >= 0) requestMove(focusPoseAt(index), "star");
      else if (rt.view.pose) requestMove(rt.view.pose, "view");
      else requestMove(overview(), "overview");
    }

    const cut = pendingCut.current;
    if (cut) {
      cut.wait -= delta;
      if (cut.wait <= 0) {
        pendingCut.current = null;
        applyPose(cut.pose, cut.kind);
        state.gl.domElement.style.opacity = "1";
      }
    }

    const flight = flightRef.current;
    if (flight) {
      flight.elapsed += delta;
      const u = flight.duration <= 0 ? 1 : Math.min(1, flight.elapsed / flight.duration);
      const e = easeInOutCubic(u);
      bezier(camera.position, flight.from, flight.control, flight.to, e);
      lookTarget.current.lerpVectors(flight.fromTarget, flight.toTarget, e);
      if (flight.roll > 0) {
        const roll = Math.sin(u * Math.PI) * flight.roll;
        camera.up.set(Math.sin(roll), Math.cos(roll), 0);
      }
      camera.lookAt(lookTarget.current);
      if (flight.kind !== "arrive") {
        camera.fov = baseFov + Math.sin(u * Math.PI) * 2.5;
        camera.updateProjectionMatrix();
      }
      rt.flightProgress = u;
      if (u >= 1) {
        flightRef.current = null;
        camera.fov = baseFov;
        camera.updateProjectionMatrix();
        applyPose({ position: flight.to, target: flight.toTarget }, flight.kind);
      }
    } else if (controls) {
      lookTarget.current.copy(controls.target);
      // The tour lingers on each star with a slow drift around it.
      if (rt.landed && rt.focusIndex >= 0) {
        const drift = rt.tour && !reducedMotion;
        if (drift !== controls.autoRotate) controls.autoRotate = drift;
        if (drift) controls.autoRotateSpeed = 0.55 * L.orbitDirection;
      }
    }

    const dimTarget = rt.focusIndex >= 0 ? 1 : 0;
    rt.dim = damp(rt.dim, dimTarget, 3.5, delta);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      enablePan={false}
      minDistance={4}
      maxDistance={150}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      autoRotateSpeed={0.32}
      minPolarAngle={0.3}
      maxPolarAngle={Math.PI - 0.3}
    />
  );
}
