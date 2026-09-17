"use client";

// Dressing for staged views: the glowing time axis with year ticks and stems
// for a timeline, floating fact panels for a comparison, technology nodes
// with links for a stack map, and a title for a constellation. The stars
// themselves are moved by the Choreographer; this fades the dressing in as
// they arrive and out as they leave.

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import { STAGE_FRAME } from "./Choreographer";
import { damp, smoothstep } from "./motion";
import { axisFragment, axisVertex, starFragment, starVertex } from "./shaders";
import { useScene } from "./SceneContext";
import { useSignals } from "./signals";
import { ACCENT } from "./tuning";
import { buildStage, toWorld, type Stage } from "./views";

const GOLD = new Color(ACCENT);

/** A strip of quads along t in [0, 1], two vertices per step. */
function ribbon(segments: number): BufferGeometry {
  const count = (segments + 1) * 2;
  const ts = new Float32Array(count);
  const sides = new Float32Array(count);
  for (let i = 0; i <= segments; i++) {
    ts[i * 2] = i / segments;
    ts[i * 2 + 1] = i / segments;
    sides[i * 2] = -1;
    sides[i * 2 + 1] = 1;
  }
  const index: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setIndex(index);
  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aT", new Float32BufferAttribute(ts, 1));
  geometry.setAttribute("aSide", new Float32BufferAttribute(sides, 1));
  return geometry;
}

function goldLines(opacity: number): LineBasicMaterial {
  return new LineBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

function TimelineDressing({ stage }: { stage: Stage }) {
  const { runtimeRef } = useScene();
  const axisRef = useRef<Mesh>(null);
  const ticksRef = useRef<LineSegments>(null);
  const stemsRef = useRef<LineSegments>(null);
  const axis = stage.axis!;

  const built = useMemo(() => {
    const from = toWorld(STAGE_FRAME, axis.from.x, axis.from.y, 0);
    const to = toWorld(STAGE_FRAME, axis.to.x, axis.to.y, 0);
    const material = new ShaderMaterial({
      vertexShader: axisVertex,
      fragmentShader: axisFragment,
      uniforms: {
        uFrom: { value: from },
        uTo: { value: to },
        uWidth: { value: 0.09 },
        uGold: { value: GOLD },
        uAlpha: { value: 0 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const axisMesh = new Mesh(ribbon(64), material);
    axisMesh.frustumCulled = false;
    axisMesh.renderOrder = 3;

    const tickPositions: number[] = [];
    for (const tick of axis.ticks) {
      const a = axis.vertical
        ? toWorld(STAGE_FRAME, axis.from.x - 0.28, tick.y, 0)
        : toWorld(STAGE_FRAME, tick.x, 0.28, 0);
      const b = axis.vertical
        ? toWorld(STAGE_FRAME, axis.from.x + 0.28, tick.y, 0)
        : toWorld(STAGE_FRAME, tick.x, -0.28, 0);
      tickPositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const tickGeometry = new BufferGeometry();
    tickGeometry.setAttribute("position", new Float32BufferAttribute(tickPositions, 3));
    const ticks = new LineSegments(tickGeometry, goldLines(0));
    ticks.frustumCulled = false;
    ticks.renderOrder = 3;

    const stemGeometry = new BufferGeometry();
    const stemPositions = new Float32BufferAttribute(new Float32Array(axis.stems.length * 6), 3);
    stemPositions.setUsage(DynamicDrawUsage);
    stemGeometry.setAttribute("position", stemPositions);
    const stems = new LineSegments(stemGeometry, goldLines(0));
    stems.frustumCulled = false;
    stems.renderOrder = 3;
    const stemStarts = axis.stems.map((stem) => toWorld(STAGE_FRAME, stem.x0, stem.y0, 0));
    return { axisMesh, ticks, stems, stemStarts };
  }, [axis]);

  useEffect(() => {
    const { axisMesh, ticks, stems } = built;
    return () => {
      axisMesh.geometry.dispose();
      (axisMesh.material as ShaderMaterial).dispose();
      ticks.geometry.dispose();
      (ticks.material as LineBasicMaterial).dispose();
      stems.geometry.dispose();
      (stems.material as LineBasicMaterial).dispose();
    };
  }, [built]);

  useFrame((state) => {
    const rt = runtimeRef.current;
    const alpha = rt.stageAlpha;
    const axisMesh = axisRef.current;
    if (axisMesh) {
      const u = (axisMesh.material as ShaderMaterial).uniforms;
      u.uAlpha.value = alpha * 0.9;
      u.uTime.value = state.clock.elapsedTime;
    }
    const ticks = ticksRef.current;
    if (ticks) (ticks.material as LineBasicMaterial).opacity = 0.55 * alpha;
    const stems = stemsRef.current;
    if (stems) {
      (stems.material as LineBasicMaterial).opacity = 0.32 * alpha;
      const attribute = stems.geometry.getAttribute("position") as Float32BufferAttribute;
      const arr = attribute.array as Float32Array;
      const p = rt.positions;
      stage.slots.forEach((slot, k) => {
        const start = built.stemStarts[k];
        if (!start) return;
        arr[k * 6] = start.x;
        arr[k * 6 + 1] = start.y;
        arr[k * 6 + 2] = start.z;
        arr[k * 6 + 3] = p[slot.index * 3];
        arr[k * 6 + 4] = p[slot.index * 3 + 1];
        arr[k * 6 + 5] = p[slot.index * 3 + 2];
      });
      attribute.needsUpdate = true;
    }
  });

  return (
    <group>
      <primitive object={built.axisMesh} ref={axisRef} />
      <primitive object={built.ticks} ref={ticksRef} />
      <primitive object={built.stems} ref={stemsRef} />
      {axis.ticks.map((tick) => (
        <Html
          key={`${tick.label}-${tick.x}-${tick.y}`}
          position={toWorld(STAGE_FRAME, tick.x, tick.y, 0)}
          center
          zIndexRange={[8, 0]}
          pointerEvents="none"
          style={{ pointerEvents: "none" }}
        >
          <span className={`sm-tick${axis.vertical ? " sm-tick-vertical" : ""}`}>{tick.label}</span>
        </Html>
      ))}
    </group>
  );
}

function ComparePanels({ stage }: { stage: Stage }) {
  const { layout, profile } = useScene();
  const panels = stage.panels!;
  const n = panels.length;
  return (
    <group>
      {panels.map((panel, i) => {
        const star = layout.stars[panel.index];
        const tilt = panel.align === "below" ? ((i - (n - 1) / 2) * -7).toFixed(1) : "0";
        const kind = star.kind.charAt(0).toUpperCase() + star.kind.slice(1);
        return (
          <Html
            key={star.id}
            position={toWorld(STAGE_FRAME, panel.x, panel.y, 0)}
            zIndexRange={[8, 0]}
            pointerEvents="none"
            style={{ pointerEvents: "none" }}
          >
            <div
              className={`sm-panel sm-panel-${panel.align}${
                profile.mobile || panel.align === "right" ? " sm-panel-compact" : ""
              }`}
              style={{ transform: `perspective(700px) rotateY(${tilt}deg)` }}
            >
              <div className="sm-panel-kind">
                {kind}
                {star.period ? ` · ${star.period}` : ""}
              </div>
              <div className="sm-panel-title">{star.label}</div>
              {star.stack.length ? (
                <div className="sm-panel-stack">
                  {star.stack.slice(0, 4).map((tech) => (
                    <span key={tech} className="sm-badge">
                      {tech}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="sm-panel-fact">{star.facet ?? star.summary}</p>
            </div>
          </Html>
        );
      })}
    </group>
  );
}

function StackDressing({ stage }: { stage: Stage }) {
  const { layout, runtimeRef, reducedMotion } = useScene();
  const { focusedStarId } = useSignals();
  const nodesRef = useRef<InstancedMesh>(null);
  const linksRef = useRef<LineSegments>(null);
  const techs = stage.techs!;

  const built = useMemo(() => {
    const n = Math.max(techs.length, 1);
    const geometry = new PlaneGeometry(2, 2);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const seeds = new Float32Array(n);
    const indices = new Float32Array(n);
    const state = new Float32Array(n * 4);
    const tint = new Color("#f3e2b3");
    techs.forEach((tech, i) => {
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
      sizes[i] = 0.42 + 0.1 * Math.min(tech.stars.length, 4);
      seeds[i] = (i * 0.37) % 1;
      indices[i] = -100;
      state[i * 4 + 1] = 1;
    });
    geometry.setAttribute("aColor", new InstancedBufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new InstancedBufferAttribute(sizes, 1));
    geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    geometry.setAttribute("aIndex", new InstancedBufferAttribute(indices, 1));
    const stateAttribute = new InstancedBufferAttribute(state, 4);
    stateAttribute.setUsage(DynamicDrawUsage);
    geometry.setAttribute("aState", stateAttribute);
    const material = new ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: {
        uTime: { value: 0 },
        uFocus: { value: -1 },
        uDim: { value: 0 },
        uTwinkle: { value: 1 },
        uSizeScale: { value: 1 },
        uCoreFade: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const nodes = new InstancedMesh(geometry, material, n);
    nodes.count = techs.length;
    nodes.frustumCulled = false;
    nodes.renderOrder = 5;
    const m = new Matrix4();
    const positions = techs.map((tech) => toWorld(STAGE_FRAME, tech.x, tech.y, 0));
    positions.forEach((p, i) => {
      m.makeTranslation(p.x, p.y, p.z);
      nodes.setMatrixAt(i, m);
    });
    nodes.instanceMatrix.needsUpdate = true;

    const pairs: { star: number; tech: number }[] = [];
    techs.forEach((tech, j) => {
      for (const star of tech.stars) pairs.push({ star, tech: j });
    });
    const linkGeometry = new BufferGeometry();
    const linkPositions = new Float32BufferAttribute(new Float32Array(Math.max(pairs.length, 1) * 6), 3);
    linkPositions.setUsage(DynamicDrawUsage);
    const linkColors = new Float32BufferAttribute(new Float32Array(Math.max(pairs.length, 1) * 6), 3);
    linkColors.setUsage(DynamicDrawUsage);
    linkGeometry.setAttribute("position", linkPositions);
    linkGeometry.setAttribute("color", linkColors);
    const links = new LineSegments(
      linkGeometry,
      new LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    links.frustumCulled = false;
    links.renderOrder = 2;
    return { nodes, links, pairs, positions };
  }, [techs]);

  useEffect(() => {
    const { nodes, links } = built;
    return () => {
      nodes.geometry.dispose();
      (nodes.material as ShaderMaterial).dispose();
      links.geometry.dispose();
      (links.material as LineBasicMaterial).dispose();
    };
  }, [built]);

  const focusIndex = focusedStarId ? (layout.indexById.get(focusedStarId) ?? -1) : -1;

  useFrame((state) => {
    const rt = runtimeRef.current;
    const alpha = rt.stageAlpha;
    const nodes = nodesRef.current;
    if (nodes) {
      const u = (nodes.material as ShaderMaterial).uniforms;
      if (!reducedMotion) u.uTime.value = state.clock.elapsedTime;
      u.uTwinkle.value = reducedMotion ? 0 : 1;
      const attribute = nodes.geometry.getAttribute("aState") as InstancedBufferAttribute;
      const arr = attribute.array as Float32Array;
      techs.forEach((tech, i) => {
        const hot = focusIndex >= 0 && tech.stars.includes(focusIndex) ? 1 : 0;
        arr[i * 4] = alpha;
        arr[i * 4 + 2] = hot * 0.8;
      });
      attribute.needsUpdate = true;
    }
    const links = linksRef.current;
    if (links) {
      const positions = links.geometry.getAttribute("position") as Float32BufferAttribute;
      const colors = links.geometry.getAttribute("color") as Float32BufferAttribute;
      const pa = positions.array as Float32Array;
      const ca = colors.array as Float32Array;
      const p = rt.positions;
      built.pairs.forEach((pair, k) => {
        const star = layout.stars[pair.star];
        const node = built.positions[pair.tech];
        pa[k * 6] = p[pair.star * 3];
        pa[k * 6 + 1] = p[pair.star * 3 + 1];
        pa[k * 6 + 2] = p[pair.star * 3 + 2];
        pa[k * 6 + 3] = node.x;
        pa[k * 6 + 4] = node.y;
        pa[k * 6 + 5] = node.z;
        const hot = focusIndex === pair.star;
        const dimmed = focusIndex >= 0 && !hot ? 0.35 : 1;
        const bright = alpha * dimmed * (hot ? 1.4 : 0.7);
        const r = (hot ? GOLD.r : star.color.r) * bright;
        const g = (hot ? GOLD.g : star.color.g) * bright;
        const b = (hot ? GOLD.b : star.color.b) * bright;
        ca[k * 6] = r;
        ca[k * 6 + 1] = g;
        ca[k * 6 + 2] = b;
        ca[k * 6 + 3] = r * 0.6;
        ca[k * 6 + 4] = g * 0.6;
        ca[k * 6 + 5] = b * 0.6;
      });
      positions.needsUpdate = true;
      colors.needsUpdate = true;
    }
  });

  return (
    <group>
      <primitive object={built.nodes} ref={nodesRef} />
      <primitive object={built.links} ref={linksRef} />
      {techs.map((tech, i) => (
        <Html
          key={tech.key}
          position={built.positions[i]}
          center
          zIndexRange={[8, 0]}
          pointerEvents="none"
          style={{ pointerEvents: "none" }}
        >
          <span
            className={`sm-tech sm-tech-${tech.side}${
              focusIndex >= 0 && tech.stars.includes(focusIndex) ? " sm-tech-hot" : ""
            }`}
          >
            {tech.label}
          </span>
        </Html>
      ))}
    </group>
  );
}

function StageTitle({ stage }: { stage: Stage }) {
  const title = stage.title!;
  return (
    <Html
      position={toWorld(STAGE_FRAME, title.x, title.y, 0)}
      center
      zIndexRange={[8, 0]}
      pointerEvents="none"
      style={{ pointerEvents: "none" }}
    >
      <span className="sm-title">{title.text}</span>
    </Html>
  );
}

export function ViewStage() {
  const { layout, runtimeRef, reducedMotion } = useScene();
  const { view } = useSignals();
  const size = useThree((state) => state.size);
  const narrow = size.width / Math.max(size.height, 1) < 0.9;
  const stage = useMemo(() => buildStage(view, layout, !narrow), [view, layout, narrow]);
  const stageRef = useRef<Stage | null>(stage);
  const [shown, setShown] = useState<Stage | null>(null);
  const lastVar = useRef(-1);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  // Mount the dressing at once; keep it while it fades out.
  useEffect(() => {
    const id = window.setTimeout(() => setShown(stage), stage ? 0 : 450);
    return () => window.clearTimeout(id);
  }, [stage]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const rt = runtimeRef.current;
    const target = stageRef.current ? smoothstep(0.55, 1, rt.view.progress) : 0;
    rt.stageAlpha = reducedMotion ? target : damp(rt.stageAlpha, target, 7, dt);
    if (Math.abs(rt.stageAlpha - lastVar.current) > 0.004) {
      lastVar.current = rt.stageAlpha;
      // On the StarMap root: drei's Html portals into a wrapper that is not
      // the canvas's parent, and every label inherits from the root.
      const root = state.gl.domElement.closest<HTMLElement>("[data-starmap]");
      root?.style.setProperty("--sm-stage", rt.stageAlpha.toFixed(3));
    }
  });

  if (!shown) return null;
  return (
    <group>
      {shown.kind === "timeline" && shown.axis ? <TimelineDressing stage={shown} /> : null}
      {shown.kind === "compare" && shown.panels ? <ComparePanels stage={shown} /> : null}
      {shown.kind === "stack" && shown.techs ? <StackDressing stage={shown} /> : null}
      {shown.title ? <StageTitle stage={shown} /> : null}
    </group>
  );
}
