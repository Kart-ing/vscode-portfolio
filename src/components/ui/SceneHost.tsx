"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useState, type ReactNode } from "react";
import { useFlight } from "@/lib/flight-state";
import { supportsWebGL } from "./webgl";

// The 3D scene loads lazily, client-only, after the HTML content has painted.
// StarMap fills its container and must sit inside FlightProvider (it does:
// SceneHost renders inside the shell frame).
const StarMap = dynamic(
  () => import("@/components/scene/StarMap").then((m) => m.StarMap),
  { ssr: false },
);

const READY_FALLBACK_MS = 3000;

interface BoundaryProps {
  onError(): void;
  children: ReactNode;
}

// If the scene bundle fails to load or throws, the static Starfield beneath
// stays and flights keep working as card-only navigation.
class SceneBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function SceneHost({ reducedMotion }: { reducedMotion: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const { finishIntro } = useFlight();

  useEffect(() => {
    if (!supportsWebGL()) return;
    // Yield to the first paint before pulling the 3D bundle in.
    const schedule =
      typeof window.requestIdleCallback === "function"
        ? (cb: () => void) => {
            const id = window.requestIdleCallback(cb, { timeout: 800 });
            return () => window.cancelIdleCallback(id);
          }
        : (cb: () => void) => {
            const id = window.setTimeout(cb, 120);
            return () => window.clearTimeout(id);
          };
    return schedule(() => setEnabled(true));
  }, []);

  // If the scene never reports readiness, reveal it anyway rather than hide it forever.
  useEffect(() => {
    if (!enabled || ready) return;
    const timer = window.setTimeout(() => setReady(true), READY_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, ready]);

  const onReady = useCallback(() => setReady(true), []);
  // A scene that throws can never end the intro, so end it here.
  const onError = useCallback(() => {
    setEnabled(false);
    finishIntro();
  }, [finishIntro]);

  if (!enabled) return null;

  return (
    <div className={ready ? "scene is-ready" : "scene"}>
      <SceneBoundary onError={onError}>
        <StarMap className="scene-canvas" reducedMotion={reducedMotion} onReady={onReady} />
      </SceneBoundary>
    </div>
  );
}
