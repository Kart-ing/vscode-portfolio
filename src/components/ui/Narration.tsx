"use client";

// The centrepiece: the question as a title, then the answer one sentence at a
// time, each citing the record. Clicking a citation flies to that star.
//
// mode "full"      title + sentences (desktop, under the masthead)
// mode "title"     title, thinking state and the "nothing answers" state (phone, top)
// mode "sentences" sentences only (phone, inside the bottom sheet)

import { Fragment } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import type { AnswerSentence, FlightStop } from "@/lib/contract";
import { useFlight } from "@/lib/flight-state";
import { Chips } from "./Chips";
import { Title, blockVariants } from "./FlightTitle";
import { getStar } from "./record-lookup";

export type PanelMode = "full" | "title" | "sentences";

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 7 },
  show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } },
};
const wordVariantsReduced: Variants = {
  hidden: { opacity: 1 },
  show: { opacity: 1 },
};
const citesVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3, delay: 0.1 } },
};
const yesVariants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 230, damping: 20 } },
};
const yesVariantsReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

function isYes(sentence: AnswerSentence): boolean {
  return sentence.citations.length === 0 && /^yes[.!]?$/i.test(sentence.text.trim());
}

function Words({ text, reduced }: { text: string; reduced: boolean }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <motion.span
      className="sentence-text"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: reduced ? 0 : 0.03 } } }}
    >
      {words.map((word, i) => (
        <Fragment key={`${i}-${word}`}>
          <motion.span className="word" variants={reduced ? wordVariantsReduced : wordVariants}>
            {word}
          </motion.span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </motion.span>
  );
}

interface SentenceProps {
  sentence: AnswerSentence;
  active: boolean;
  reduced: boolean;
  focusedFacetId: string | null;
  onCite(stop: FlightStop): void;
}

/** One chip per star: a sentence citing two lines of the same star shows the star once. */
function chipsFor(sentence: AnswerSentence): FlightStop[] {
  const seen = new Set<string>();
  return sentence.citations.filter((cite) => {
    if (seen.has(cite.starId)) return false;
    seen.add(cite.starId);
    return true;
  });
}

function Sentence({ sentence, active, reduced, focusedFacetId, onCite }: SentenceProps) {
  const chips = chipsFor(sentence);
  return (
    <li className={active ? "sentence is-active" : "sentence"} aria-current={active ? "true" : undefined}>
      <Words text={sentence.text} reduced={reduced} />
      {chips.length > 0 && (
        <motion.span
          className="cites"
          role="group"
          aria-label="Sources in the record"
          initial="hidden"
          animate="show"
          variants={reduced ? wordVariantsReduced : citesVariants}
        >
          {chips.map((cite) => {
            const star = getStar(cite.starId);
            const hit = sentence.citations.some((c) => c.starId === cite.starId && c.facetId === focusedFacetId);
            return (
              <button
                key={cite.facetId}
                type="button"
                className={hit ? "cite is-active" : "cite"}
                aria-pressed={hit}
                title={`Fly to ${star?.label ?? cite.starId}`}
                onClick={() => onCite(cite)}
              >
                {star?.label ?? cite.starId}
              </button>
            );
          })}
        </motion.span>
      )}
    </li>
  );
}

function Yes({ reduced }: { reduced: boolean }) {
  return (
    <div className="yes-block">
      <motion.p className="display yes" variants={reduced ? yesVariantsReduced : yesVariants} initial="hidden" animate="show">
        Yes.
      </motion.p>
      <motion.p className="proof-eyebrow mono" variants={blockVariants} initial="hidden" animate="show">
        Proof from the record
      </motion.p>
    </div>
  );
}

function Thinking() {
  return (
    <motion.p className="status-line thinking" role="status" variants={blockVariants} initial="hidden" animate="show" exit="exit">
      <span className="beam-indicator" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      Thinking…
    </motion.p>
  );
}

function ModeLine() {
  const { answerMode, narration, tour, view, status } = useFlight();
  if (narration.length === 0 || status !== "flying") return null;
  const count = new Set(narration.flatMap((sentence) => sentence.citations.map((c) => c.facetId))).size;
  const citations = `${count} ${count === 1 ? "citation" : "citations"}`;
  let label: string;
  if (tour.active) label = `Guided tour · step ${tour.index + 1} of ${tour.total}`;
  else if (answerMode === "model") label = `Answered by GLM-5.2 · ${citations}`;
  else if (answerMode === "cache") label = `Replayed answer · ${citations}`;
  else if (answerMode === null) label = `Answering · ${citations}`;
  else label = `From the record · ${citations}`;
  if (view) label += ` · ${view.kind} view`;
  return (
    <p className="mode-line" data-mode={tour.active ? "tour" : (answerMode ?? "pending")}>
      <span className="mode-dot" aria-hidden="true" />
      {label}
    </p>
  );
}

interface NarrationPanelProps {
  reduced: boolean;
  mode: PanelMode;
  /** After a citation is followed, for example to switch the phone sheet to the star. */
  onCite?(): void;
}

export function NarrationPanel({ reduced, mode, onCite }: NarrationPanelProps) {
  const { status, question, narration, activeSentence, focusedFacetId, answerMode, focusCitation } = useFlight();
  const showTitle = mode !== "sentences";
  const showSentences = mode !== "title";
  const visible = !!question && status !== "idle";
  const leadsWithYes = answerMode === "advocate" && narration.length > 0 && isYes(narration[0]);
  const sentences = leadsWithYes ? narration.slice(1) : narration;
  const offset = leadsWithYes ? 1 : 0;

  const follow = (stop: FlightStop) => {
    focusCitation(stop);
    onCite?.();
  };

  return (
    <div className={mode === "sentences" ? "narration-host is-sheet" : "title-slot"}>
      <AnimatePresence mode="wait">
        {visible && question && (
          <motion.div key={`q:${question}`} exit={{ opacity: 0, transition: { duration: 0.18 } }}>
            {showTitle && <Title question={question} reduced={reduced} />}
            {showTitle && status === "asking" && narration.length === 0 && <Thinking />}
            {showTitle && status === "none" && (
              <motion.div className="none-block" role="status" variants={blockVariants} initial="hidden" animate="show" exit="exit">
                <p>Nothing in the record answers that.</p>
                <Chips withTour={false} />
              </motion.div>
            )}
            {showSentences && narration.length > 0 && (
              <div className="narration" data-mode={answerMode ?? "pending"}>
                {leadsWithYes && <Yes reduced={reduced} />}
                {sentences.length > 0 && (
                  <ol className="sentences">
                    {sentences.map((sentence, i) => (
                      <Sentence
                        key={`${i + offset}-${sentence.text.slice(0, 24)}`}
                        sentence={sentence}
                        active={activeSentence === i + offset}
                        reduced={reduced}
                        focusedFacetId={focusedFacetId}
                        onCite={follow}
                      />
                    ))}
                  </ol>
                )}
                <ModeLine />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
