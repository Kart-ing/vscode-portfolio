"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { FlightProvider, useFlight } from "@/lib/flight-state";
import { Chips } from "./Chips";
import { FlightTitle } from "./FlightTitle";
import { PromptBox } from "./PromptBox";
import { SceneHost } from "./SceneHost";
import { Starfield } from "./Starfield";
import { StopCardHost } from "./StopCard";

interface ShellProps {
  /** Server-rendered identity block: name, role, tagline, links. */
  identity: ReactNode;
  /** Server-rendered footer. */
  footer: ReactNode;
}

export function Shell({ identity, footer }: ShellProps) {
  return (
    <FlightProvider>
      <ShellFrame identity={identity} footer={footer} />
    </FlightProvider>
  );
}

function Notice() {
  const { error, dismissError } = useFlight();
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          className="notice"
          role="alert"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.25 }}
          onClick={dismissError}
        >
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ShellFrame({ identity, footer }: ShellProps) {
  const flight = useFlight();
  const reduced = useReducedMotion() ?? false;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState("");

  const { reset } = flight;
  const resetAndFocus = useCallback(() => {
    reset();
    setDraft("");
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [reset]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (event.key === "Escape") {
        if (flight.status === "idle" && !flight.error) {
          if (draft) {
            setDraft("");
            event.preventDefault();
          }
          return;
        }
        event.preventDefault();
        resetAndFocus();
        return;
      }
      if (typing) return;
      if (flight.status !== "flying" || !flight.plan) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        flight.next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        flight.prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flight, draft, resetAndFocus]);

  const showChips = flight.status === "idle";

  return (
    <MotionConfig reducedMotion="user">
      <div className="shell" data-status={flight.status}>
        <Starfield />
        <SceneHost reducedMotion={reduced} />
        <div className="grain" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
        <div className="scrim-top" aria-hidden="true" />
        <div className="scrim-bottom" aria-hidden="true" />

        <header className="masthead">{identity}</header>

        <main className="stage" id="main">
          <FlightTitle reduced={reduced} />
          <div className="card-slot">
            <StopCardHost reduced={reduced} onClose={resetAndFocus} />
          </div>
          <Notice />
        </main>

        <div className="dock">
          <AnimatePresence initial={false}>
            {showChips && (
              <motion.div
                key="chips"
                className="dock-chips"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.22 }}
              >
                <Chips />
              </motion.div>
            )}
          </AnimatePresence>
          <PromptBox inputRef={inputRef} value={draft} onChange={setDraft} />
          {footer}
        </div>
      </div>
    </MotionConfig>
  );
}
