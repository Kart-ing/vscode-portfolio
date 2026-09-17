"use client";

import { Fragment } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useFlight } from "@/lib/flight-state";
import { Chips } from "./Chips";
import { getStar } from "./record-lookup";

const wordVariants: Variants = {
  hidden: { y: "112%", opacity: 0 },
  show: { y: "0%", opacity: 1, transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] } },
  exit: { y: "-40%", opacity: 0, transition: { duration: 0.22, ease: [0.55, 0.085, 0.68, 0.53] } },
};

const wordVariantsReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const blockVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, transition: { duration: 0.18 } },
};

function lengthClass(question: string): "short" | "long" | "epic" {
  if (question.length > 110) return "epic";
  if (question.length > 60) return "long";
  return "short";
}

function Title({ question, reduced }: { question: string; reduced: boolean }) {
  const words = question.split(/\s+/).filter(Boolean);
  return (
    <motion.h2
      className="display-condensed title"
      data-length={lengthClass(question)}
      initial="hidden"
      animate="show"
      exit="exit"
      variants={{ show: { transition: { staggerChildren: reduced ? 0 : 0.045 } } }}
    >
      {words.map((word, i) => (
        <Fragment key={`${i}-${word}`}>
          <span className="word-clip">
            <motion.span variants={reduced ? wordVariantsReduced : wordVariants}>{word}</motion.span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </motion.h2>
  );
}

function Route() {
  const { plan, stopIndex, goTo } = useFlight();
  if (!plan || plan.stops.length === 0) return null;
  return (
    <motion.nav className="route" aria-label="Flight plan" variants={blockVariants} initial="hidden" animate="show" exit="exit">
      {plan.stops.map((stop, i) => {
        const star = getStar(stop.starId);
        const current = i === stopIndex;
        return (
          <button
            key={stop.facetId}
            type="button"
            className="route-stop"
            aria-current={current ? "step" : undefined}
            aria-label={`Stop ${i + 1} of ${plan.stops.length}: ${star?.label ?? stop.starId}`}
            onClick={() => goTo(i)}
          >
            {i > 0 && <span className="route-line" aria-hidden="true" />}
            <span className="route-dot" aria-hidden="true" />
            <span className="route-index">{String(i + 1).padStart(2, "0")}</span>
            <span className="route-label">{star?.label ?? stop.starId}</span>
          </button>
        );
      })}
    </motion.nav>
  );
}

export function FlightTitle({ reduced }: { reduced: boolean }) {
  const { status, plan, pendingQuestion } = useFlight();

  let question: string | null = null;
  if (status === "asking") question = pendingQuestion;
  else if ((status === "flying" || status === "none") && plan) question = plan.question;

  return (
    <div className="title-slot">
      <AnimatePresence mode="wait">
        {question && (
          <motion.div key={`${status === "asking" ? "ask" : "plan"}:${question}`} exit={{ opacity: 0, transition: { duration: 0.18 } }}>
            <Title question={question} reduced={reduced} />
            {status === "asking" && (
              <motion.p className="status-line" role="status" variants={blockVariants} initial="hidden" animate="show" exit="exit">
                <span className="pulse" aria-hidden="true" />
                Plotting a course…
              </motion.p>
            )}
            {status === "flying" && <Route />}
            {status === "none" && (
              <motion.div className="none-block" role="status" variants={blockVariants} initial="hidden" animate="show" exit="exit">
                <p>Nothing in the record answers that.</p>
                <Chips />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
