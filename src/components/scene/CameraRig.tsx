"use client";

// Owns the camera. In the overview it hands control to damped OrbitControls
// with a slow auto-orbit. When the focused star changes it disables the
// controls and flies along a raised quadratic curve to a pose that frames the
// star left of centre (wide screens) or in the upper half (narrow screens),
// then hands control back with the new orbit target.

import { useRef, type ComponentRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MathUtils, Matrix4, PerspectiveCamera, Vector3 } from "three";
import { useFlight } from "@/lib/flight-state";
import type { StarNode } from "./layout";
import { useScene } from "./SceneContext";
import { sceneTuning } from "./tuning";

type Controls = ComponentRef<typeof OrbitControls>;
type FlightKind = "intro" | "star" | "overview";

interface Pose {
  position: Vector3;
  target: Vector3;
}

interface Flight {
  from: Vector3;
  control: Vector3;
  to: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
  duration: number;
  elapsed: number;
  kind: FlightKind;
}

interface PendingCut {
  pose: Pose;
  kind: FlightKind;
  wait: number;
}

const UP = new Vector3(0, 1, 0);
const UNSET = Symbol("unset");

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

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
  cameraPosition: Vector3,
  fov: number,
  aspect: number,
  narrow: boolean,
): Pose {
  const S = star.position;
  const distance = (narrow ? 7 : 4.5) + star.size * (narrow ? 9 : 7.5);
  // Approach from roughly where the camera is, pulled toward a canonical
  // direction that looks inward across the disk from slightly above it.
  const fromCamera = new Vector3().subVectors(cameraPosition, S);
  const fromCameraDir =
    fromCamera.lengthSq() > 1e-4 ? fromCamera.normalize() : new Vector3(0, 0.5, 1).normalize();
  const outward = new Vector3(S.x, 0, S.z);
  const outwardDir = outward.lengthSq() > 1 ? outward.normalize() : new Vector3(0, 0, 1);
  const canonical = outwardDir.multiplyScalar(0.6).add(new Vector3(0, 0.62, 0)).normalize();
  const dir = fromCameraDir.multiplyScalar(0.42).add(canonical.multiplyScalar(0.58)).normalize();
  if (dir.y < 0.3) {
    dir.y = 0.3;
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
  // Wide: 38% across and 58% down, clear of the title block (top-left) and
  // the card (right). Narrow: centred, 42% down, between title and sheet.
  const ndcX = narrow ? 0 : -0.24;
  const ndcY = narrow ? 0.16 : -0.16;
  const target = S.clone()
    .sub(right.multiplyScalar(ndcX * distance * tanHalf * aspect))
    .sub(up.multiplyScalar(ndcY * distance * tanHalf));
  return { position: target.clone().add(dir.multiplyScalar(distance)), target };
}

export function CameraRig() {
  const { layout, runtimeRef, reducedMotion } = useScene();
  const { focusedStarId } = useFlight();
  const controlsRef = useRef<Controls>(null);
  const flightRef = useRef<Flight | null>(null);
  const pendingCut = useRef<PendingCut | null>(null);
  const lastFocus = useRef<string | null | typeof UNSET>(UNSET);
  const lookTarget = useRef(new Vector3());

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const camera = state.camera as PerspectiveCamera;
    const controls = controlsRef.current;
    const rt = runtimeRef.current;
    const aspect = state.size.width / Math.max(state.size.height, 1);
    const narrow = aspect < 0.9;
    const baseFov = narrow ? 70 : 50;
    if (!flightRef.current && Math.abs(camera.fov - baseFov) > 0.01) {
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
    }

    const applyPose = (pose: Pose, kind: FlightKind) => {
      camera.position.copy(pose.position);
      lookTarget.current.copy(pose.target);
      camera.lookAt(pose.target);
      if (controls) {
        controls.target.copy(pose.target);
        controls.enabled = true;
        controls.autoRotate = kind !== "star" && !reducedMotion;
        controls.update();
      }
      rt.flying = false;
      rt.flightProgress = 1;
      rt.landed = kind === "star";
    };

    const beginFlight = (pose: Pose, kind: FlightKind) => {
      const from = camera.position.clone();
      const fromTarget = (
        flightRef.current || !controls ? lookTarget.current : controls.target
      ).clone();
      const distance = from.distanceTo(pose.position);
      const seconds =
        kind === "intro"
          ? 2.8
          : MathUtils.clamp(1.4 + (0.6 * (distance - 8)) / 50, 1.4, 2.0);
      const mid = from.clone().lerp(pose.position, 0.5);
      const travel = pose.position.clone().sub(from);
      const side = new Vector3().crossVectors(travel, UP);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      const lift = kind === "intro" ? 0.06 : 0.22;
      const control = mid
        .add(UP.clone().multiplyScalar(distance * lift))
        .add(side.multiplyScalar(distance * 0.08));
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
      };
    };

    const requestMove = (pose: Pose, kind: FlightKind) => {
      if (!reducedMotion) {
        beginFlight(pose, kind);
        return;
      }
      // Reduced motion: a quick fade to black, an instant cut, a fade back.
      if (kind === "intro") {
        applyPose(pose, kind);
        return;
      }
      state.gl.domElement.style.opacity = "0";
      pendingCut.current = { pose, kind, wait: 0.18 };
    };

    // React to focus changes. The first frame plays the arrival.
    if (lastFocus.current === UNSET) {
      lastFocus.current = null;
      const overview = overviewPose(camera.position, layout.radius, baseFov, aspect, narrow);
      if (reducedMotion) {
        applyPose(overview, "intro");
      } else {
        const start = overviewPose(camera.position, layout.radius, baseFov, aspect, narrow, 1.45);
        start.position.y += 14;
        camera.position.copy(start.position);
        camera.lookAt(start.target);
        lookTarget.current.copy(start.target);
        beginFlight(overview, "intro");
      }
    }
    if (focusedStarId !== lastFocus.current) {
      lastFocus.current = focusedStarId;
      const index = focusedStarId ? (layout.indexById.get(focusedStarId) ?? -1) : -1;
      rt.focusIndex = index;
      if (index >= 0) {
        const star = layout.stars[index];
        requestMove(focusPose(star, camera.position, baseFov, aspect, narrow), "star");
      } else {
        requestMove(
          overviewPose(camera.position, layout.radius, baseFov, aspect, narrow),
          "overview",
        );
      }
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
      camera.lookAt(lookTarget.current);
      if (flight.kind !== "intro") {
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
    }

    const dimTarget = rt.focusIndex >= 0 ? 1 : 0;
    rt.dim += (dimTarget - rt.dim) * (1 - Math.exp(-delta * 3.5));
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
