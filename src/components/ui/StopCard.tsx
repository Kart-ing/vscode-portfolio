"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import type { Facet, Star } from "@/lib/contract";
import { useFlight } from "@/lib/flight-state";
import {
  KIND_LABEL,
  evidenceFor,
  getConstellationLabel,
  getFacet,
  getFacets,
  getStar,
} from "./record-lookup";
import { useMediaQuery } from "./use-media-query";

const plateVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, scale: 1.045, y: dir * 22, filter: "blur(10px)" }),
  center: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.62,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: (dir: number) => ({
    opacity: 0,
    scale: 0.94,
    y: dir * -14,
    filter: "blur(8px)",
    transition: { duration: 0.3, ease: [0.55, 0.085, 0.68, 0.53] },
  }),
};

const lineVariants: Variants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0, transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, transition: { duration: 0.16 } },
};

const plateVariantsReduced: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.28 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const lineVariantsReduced: Variants = {
  enter: { opacity: 1 },
  center: { opacity: 1 },
  exit: { opacity: 1 },
};

interface CardProps {
  cardKey: string;
  star: Star;
  facets: Facet[];
  highlightId: string | null;
  counter: { index: number; total: number } | null;
  direction: 1 | -1;
  reduced: boolean;
  onPrev(): void;
  onNext(): void;
  onClose(): void;
}

function Card({ star, facets, highlightId, counter, direction, reduced, onPrev, onNext, onClose }: CardProps) {
  // On phones the card is a bottom sheet capped at ~45dvh: it leads with the
  // answering line and the evidence, and keeps the star's other lines behind a
  // disclosure that expands in place and scrolls inside the sheet.
  const compact = useMediaQuery("(max-width: 767px)");
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const primary = highlightId ? getFacet(highlightId) : undefined;
  const lead = primary ?? facets[0];
  const rest = facets.filter((facet) => facet.id !== lead?.id);
  const evidence = evidenceFor(star, primary, rest);
  const collapsible = compact && rest.length > 0;
  const meta = [getConstellationLabel(star.constellation), KIND_LABEL[star.kind], star.period]
    .filter(Boolean)
    .join(" · ");
  const headingId = `card-${star.id}`;
  const moreId = `more-${star.id}`;
  const plate = reduced ? plateVariantsReduced : plateVariants;
  const line = reduced ? lineVariantsReduced : lineVariants;
  const restClass = highlightId ? "facet" : "facet is-plain";

  return (
    <motion.article
      className="plate"
      custom={direction}
      variants={plate}
      initial="enter"
      animate="center"
      exit="exit"
      aria-labelledby={headingId}
    >
      <div className="plate-body">
        <motion.div className="plate-meta" variants={line}>
          <span>{meta}</span>
          {counter && (
            <span className="counter" aria-label={`Stop ${counter.index} of ${counter.total}`}>
              {counter.index} / {counter.total}
            </span>
          )}
        </motion.div>
        <motion.h3 id={headingId} className="display-small plate-title" variants={line}>
          {star.label}
        </motion.h3>
        <ul className="facets">
          {lead && (
            <motion.li className={highlightId ? "facet is-hit" : "facet is-plain"} variants={line}>
              {lead.text}
            </motion.li>
          )}
          {!collapsible &&
            rest.map((facet) => (
              <motion.li key={facet.id} className={restClass} variants={line}>
                {facet.text}
              </motion.li>
            ))}
        </ul>
        {evidence.length > 0 && (
          <motion.div className="evidence" variants={line} aria-label="Evidence">
            {evidence.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label}
                <span className="arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </motion.div>
        )}
        {collapsible && (
          <motion.div ref={moreRef} variants={line}>
            <button
              type="button"
              className="facet-more"
              aria-expanded={more}
              aria-controls={moreId}
              onClick={() => setMore((open) => !open)}
            >
              <span className="icon" aria-hidden="true">
                {more ? "−" : "+"}
              </span>
              {more ? "Less" : "More from the record"}
              <span className="count">{rest.length}</span>
            </button>
            <AnimatePresence initial={false}>
              {more && (
                <motion.ul
                  id={moreId}
                  className="facets facets-more"
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduced ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
                  style={{ overflow: "hidden" }}
                  onAnimationComplete={() =>
                    // Keep the "Less" button in view with the extra lines beneath it.
                    moreRef.current?.scrollIntoView({
                      block: "start",
                      behavior: reduced ? "auto" : "smooth",
                    })
                  }
                >
                  {rest.map((facet) => (
                    <li key={facet.id} className={restClass}>
                      {facet.text}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
      <div className="plate-nav">
        {counter ? (
          <>
            <button type="button" className="nav-btn" onClick={onPrev} disabled={counter.index <= 1}>
              <span className="key" aria-hidden="true">
                ←
              </span>
              Previous
            </button>
            <button type="button" className="nav-btn" onClick={onClose}>
              <span className="key" aria-hidden="true">
                Esc
              </span>
              Overview
            </button>
            <button type="button" className="nav-btn" onClick={onNext} disabled={counter.index >= counter.total}>
              Next
              <span className="key" aria-hidden="true">
                →
              </span>
            </button>
          </>
        ) : (
          <button type="button" className="nav-btn" onClick={onClose}>
            <span className="key" aria-hidden="true">
              Esc
            </span>
            Back to overview
          </button>
        )}
      </div>
    </motion.article>
  );
}

export function StopCardHost({ reduced, onClose }: { reduced: boolean; onClose(): void }) {
  const { status, plan, stopIndex, focusedStarId, direction, next, prev } = useFlight();

  let card: CardProps | null = null;
  if (status === "flying") {
    const stop = plan?.stops[stopIndex];
    if (plan && stop) {
      const star = getStar(stop.starId);
      if (star) {
        card = {
          cardKey: `${stopIndex}:${stop.facetId}`,
          star,
          facets: getFacets(star.id),
          highlightId: stop.facetId,
          counter: { index: stopIndex + 1, total: plan.stops.length },
          direction,
          reduced,
          onPrev: prev,
          onNext: next,
          onClose,
        };
      }
    } else if (focusedStarId) {
      const star = getStar(focusedStarId);
      if (star) {
        card = {
          cardKey: `star:${star.id}`,
          star,
          facets: getFacets(star.id),
          highlightId: null,
          counter: null,
          direction,
          reduced,
          onPrev: prev,
          onNext: next,
          onClose,
        };
      }
    }
  }

  const announcement = card
    ? card.counter
      ? `Stop ${card.counter.index} of ${card.counter.total}: ${card.star.label}`
      : card.star.label
    : "";

  return (
    <>
      {/* Screen readers hear where the flight is without the whole card being re-read. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <AnimatePresence mode="popLayout" custom={direction}>
        {card && <Card key={card.cardKey} {...card} />}
      </AnimatePresence>
    </>
  );
}
