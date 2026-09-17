"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { FlightProvider, useFlight } from "@/lib/flight-state";
import { Chips } from "./Chips";
import { NarrationPanel } from "./Narration";
import { PromptBox } from "./PromptBox";
import { SceneHost } from "./SceneHost";
import { Starfield } from "./Starfield";
import { StopCardHost } from "./StopCard";
import { TimelineScrubber } from "./TimelineScrubber";
import { TourBar } from "./TourBar";
import { getStar } from "./record-lookup";
import { sound } from "./sound";
import { useMediaQuery } from "./use-media-query";
import { supportsWebGL } from "./webgl";

// If the scene never reports the intro's end (no WebGL, a slow load), the
// visitor still gets the page.
const INTRO_MAX_MS = 9000;

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

function IntroSkip() {
  const { intro, finishIntro } = useFlight();
  return (
    <AnimatePresence>
      {intro === "playing" && (
        <motion.button
          key="skip"
          type="button"
          className="intro-skip"
          onClick={finishIntro}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.5, duration: 0.4 } }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          <span className="key" aria-hidden="true">
            Esc
          </span>
          Skip intro
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// Listens to the flight and plays the synthesized cues. The first pointer or
// key press arms the pad when the stored preference is on.
function AmbientSound() {
  const { focusedStarId, status, narration } = useFlight();
  const lastFocus = useRef<string | null>(null);
  const lastStatus = useRef<string>("idle");
  const lastCount = useRef(0);

  useEffect(() => {
    const arm = () => sound.arm();
    window.addEventListener("pointerdown", arm, { passive: true });
    window.addEventListener("keydown", arm);
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);

  useEffect(() => {
    if (focusedStarId && focusedStarId !== lastFocus.current) sound.whoosh();
    lastFocus.current = focusedStarId;
  }, [focusedStarId]);

  useEffect(() => {
    if (status === "asking" && lastStatus.current !== "asking") sound.whoosh();
    lastStatus.current = status;
  }, [status]);

  useEffect(() => {
    const latest = narration[narration.length - 1];
    if (narration.length > lastCount.current && latest && latest.citations.length > 0) sound.chime();
    lastCount.current = narration.length;
  }, [narration]);

  return null;
}

// Phone layout: the answer and the focused star share one bottom sheet, as
// tabs. A new sentence brings the Answer tab back; following a citation
// switches to the star.
function SheetBody({ reduced, onClose, hasAnswer, starLabel }: { reduced: boolean; onClose(): void; hasAnswer: boolean; starLabel: string | null }) {
  const [choice, setChoice] = useState<"answer" | "star" | null>(null);
  const tab = starLabel === null ? "answer" : (choice ?? (hasAnswer ? "answer" : "star"));
  return (
    <>
      {hasAnswer && (
        <div className="sheet-tabs" role="tablist" aria-label="Answer and star">
          <button
            type="button"
            role="tab"
            className="sheet-tab"
            aria-selected={tab === "answer"}
            onClick={() => setChoice("answer")}
          >
            Answer
          </button>
          {starLabel !== null && (
            <button
              type="button"
              role="tab"
              className="sheet-tab"
              aria-selected={tab === "star"}
              onClick={() => setChoice("star")}
            >
              {starLabel}
            </button>
          )}
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Back to overview">
            ✕
          </button>
        </div>
      )}
      <div className="sheet-body" role={hasAnswer ? "tabpanel" : undefined}>
        {tab === "answer" && hasAnswer ? (
          <NarrationPanel reduced={reduced} mode="sentences" onCite={() => setChoice("star")} />
        ) : (
          <StopCardHost reduced={reduced} onClose={onClose} bare />
        )}
      </div>
    </>
  );
}

function MobileSheet({ reduced, onClose }: { reduced: boolean; onClose(): void }) {
  const { status, narration, focusedStarId, question } = useFlight();
  const hasAnswer = status === "flying" && narration.length > 0;
  const star = status === "flying" && focusedStarId ? getStar(focusedStarId) : undefined;
  const open = hasAnswer || !!star;
  return (
    <div className="sheet-slot">
      <AnimatePresence>
        {open && (
          <motion.section
            key="sheet"
            className="plate sheet"
            aria-label="Answer"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 18 }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          >
            <SheetBody
              key={`${question ?? ""}:${narration.length}`}
              reduced={reduced}
              onClose={onClose}
              hasAnswer={hasAnswer}
              starLabel={star?.label ?? null}
            />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShellFrame({ identity, footer }: ShellProps) {
  const flight = useFlight();
  const reduced = useReducedMotion() ?? false;
  const compact = useMediaQuery("(max-width: 767px)");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState("");

  const { reset, finishIntro } = flight;
  const resetAndFocus = useCallback(() => {
    reset();
    setDraft("");
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [reset]);

  useEffect(() => {
    if (flight.intro !== "playing") return;
    if (!supportsWebGL()) {
      finishIntro();
      return;
    }
    const timer = window.setTimeout(finishIntro, INTRO_MAX_MS);
    return () => window.clearTimeout(timer);
  }, [flight.intro, finishIntro]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (event.key === "Escape") {
        if (flight.intro === "playing") {
          event.preventDefault();
          flight.finishIntro();
          return;
        }
        if (flight.tour.active) {
          event.preventDefault();
          flight.stopTour();
          return;
        }
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
      if (flight.tour.active) {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          flight.nextTourStep();
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          flight.prevTourStep();
        } else if (event.key === " ") {
          event.preventDefault();
          if (flight.tour.paused) flight.resumeTour();
          else flight.pauseTour();
        }
        return;
      }
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

  const introDone = flight.intro === "done";
  const showChips = flight.status === "idle" && !flight.tour.active;
  const showScrubber = introDone && !flight.tour.active;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="shell"
        data-status={flight.status}
        data-intro={flight.intro}
        data-tour={flight.tour.active ? "on" : "off"}
        data-panel={flight.question ? "on" : "off"}
      >
        <Starfield />
        <SceneHost reducedMotion={reduced} />
        <div className="grain" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
        <div className="scrim-top" aria-hidden="true" />
        <div className="scrim-bottom" aria-hidden="true" />
        <div className="scrim-left" aria-hidden="true" />

        <header className="masthead">{identity}</header>

        <main className="stage" id="main">
          <NarrationPanel reduced={reduced} mode={compact ? "title" : "full"} />
          {compact ? (
            <MobileSheet reduced={reduced} onClose={resetAndFocus} />
          ) : (
            <div className="card-slot">
              <StopCardHost reduced={reduced} onClose={resetAndFocus} />
            </div>
          )}
          {!compact && showScrubber && (
            <div className="scrubber-slot">
              <TimelineScrubber />
            </div>
          )}
          <Notice />
          <IntroSkip />
        </main>

        <div className="dock">
          <TourBar reduced={reduced} />
          {compact && showScrubber && <TimelineScrubber className="is-mobile" />}
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
        <AmbientSound />
      </div>
    </MotionConfig>
  );
}
