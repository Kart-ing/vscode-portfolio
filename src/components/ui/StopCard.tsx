"use client";

import { useRef, useState, type MouseEvent } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import type { Facet, MediaItem, RepoPulse, Star } from "@/lib/contract";
import { useFlight } from "@/lib/flight-state";
import { compactCount, relativeTime, useNow } from "./pulse-format";
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

const PARALLAX_PX = 7;

// The owner's own image of the work. Lazy, sized from the record so nothing
// shifts, and it drifts a few pixels against the cursor on hover.
function Media({ media, reduced }: { media: MediaItem; reduced: boolean }) {
  const [failed, setFailed] = useState(false);
  const frame = useRef<HTMLDivElement | null>(null);
  if (failed) return null;
  const ratio = media.width && media.height ? `${media.width} / ${media.height}` : "16 / 10";

  const onMove = (event: MouseEvent<HTMLDivElement>) => {
    const el = frame.current;
    if (reduced || !el) return;
    const rect = el.getBoundingClientRect();
    const dx = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
    const dy = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
    el.style.setProperty("--px", `${(-dx * PARALLAX_PX * 2).toFixed(1)}px`);
    el.style.setProperty("--py", `${(-dy * PARALLAX_PX * 2).toFixed(1)}px`);
  };
  const onLeave = () => {
    const el = frame.current;
    if (!el) return;
    el.style.setProperty("--px", "0px");
    el.style.setProperty("--py", "0px");
  };

  return (
    <motion.div
      ref={frame}
      className="card-media"
      style={{ aspectRatio: ratio }}
      variants={reduced ? lineVariantsReduced : lineVariants}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {media.kind === "video" ? (
        <video
          src={media.src}
          muted
          loop
          playsInline
          autoPlay={!reduced}
          preload="metadata"
          aria-label={media.alt}
          onError={() => setFailed(true)}
        />
      ) : (
        // A plain <img>: the file is the owner's own, already sized, and the
        // card must not pull the image runtime into the first load.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      {media.credit && (
        <a className="card-credit" href={media.credit.url} target="_blank" rel="noopener noreferrer">
          {media.credit.label}
        </a>
      )}
    </motion.div>
  );
}

// Live GitHub stats from /api/pulse, formatted in the browser.
function Live({ pulse }: { pulse: RepoPulse }) {
  const now = useNow();
  const pushed = relativeTime(pulse.lastPushAt, now);
  const active = pulse.pushesLast30d > 0;
  const starred = pulse.stars > 0;
  if (!starred && !pushed && !active) return null;
  return (
    <p className="live" aria-label="Live repository activity">
      {starred && <span className="star-count">★ {compactCount(pulse.stars)}</span>}
      {pushed && (
        <>
          {starred && (
            <span className="sep" aria-hidden="true">
              ·
            </span>
          )}
          <span>pushed {pushed}</span>
        </>
      )}
      {active && (
        <span className="live-badge" title={`${pulse.pushesLast30d} pushes in the last 30 days`}>
          <span className="live-dot" aria-hidden="true" />
          active
        </span>
      )}
    </p>
  );
}

interface CardProps {
  cardKey: string;
  star: Star;
  facets: Facet[];
  highlightId: string | null;
  counter: { index: number; total: number } | null;
  direction: 1 | -1;
  reduced: boolean;
  pulse: RepoPulse | undefined;
  /** Inside the phone sheet: no plate chrome of its own. */
  bare: boolean;
  onPrev(): void;
  onNext(): void;
  onClose(): void;
}

function Card({ star, facets, highlightId, counter, direction, reduced, pulse, bare, onPrev, onNext, onClose }: CardProps) {
  // On phones the card leads with the answering line and the evidence, and
  // keeps the star's other lines behind a disclosure that expands in place.
  const compact = useMediaQuery("(max-width: 767px)");
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const primary = highlightId ? getFacet(highlightId) : undefined;
  const lead = primary ?? facets[0];
  const rest = facets.filter((facet) => facet.id !== lead?.id);
  const evidence = evidenceFor(star, primary, rest);
  if (star.repo && !evidence.some((link) => link.url.includes(`github.com/${star.repo}`))) {
    evidence.push({ label: "Repository", url: `https://github.com/${star.repo}` });
  }
  const collapsible = compact && rest.length > 0;
  const meta = [getConstellationLabel(star.constellation), KIND_LABEL[star.kind], star.period]
    .filter(Boolean)
    .join(" · ");
  const headingId = `card-${star.id}`;
  const moreId = `more-${star.id}`;
  const plate = reduced ? plateVariantsReduced : plateVariants;
  const line = reduced ? lineVariantsReduced : lineVariants;
  const restClass = highlightId ? "facet" : "facet is-plain";
  const media = star.media?.find((item) => item.kind === "image") ?? star.media?.[0];

  return (
    <motion.article
      className={bare ? "plate is-bare" : "plate"}
      custom={direction}
      variants={plate}
      initial="enter"
      animate="center"
      exit="exit"
      aria-labelledby={headingId}
    >
      <div className="plate-body">
        {media && <Media media={media} reduced={reduced} />}
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
        {pulse && (
          <motion.div variants={line}>
            <Live pulse={pulse} />
          </motion.div>
        )}
        {star.stack && star.stack.length > 0 && (
          <motion.ul className="stack" aria-label="Stack" variants={line}>
            {star.stack.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </motion.ul>
        )}
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

interface HostProps {
  reduced: boolean;
  onClose(): void;
  bare?: boolean;
}

// The card for the focused star. While a narration plays, the highlighted
// line is the citation the camera is on, and Previous/Next step through the
// cited sentences.
export function StopCardHost({ reduced, onClose, bare = false }: HostProps) {
  const { status, focusedStarId, focusedFacetId, plan, stopIndex, activeSentence, direction, next, prev, pulses, tour } =
    useFlight();

  let card: CardProps | null = null;
  if (status === "flying" && focusedStarId) {
    const star = getStar(focusedStarId);
    if (star) {
      const counted = !!plan && plan.stops.length > 1 && activeSentence >= 0 && !tour.active;
      card = {
        cardKey: `${star.id}:${focusedFacetId ?? ""}`,
        star,
        facets: getFacets(star.id),
        highlightId: focusedFacetId,
        counter: counted && plan ? { index: stopIndex + 1, total: plan.stops.length } : null,
        direction,
        reduced,
        pulse: pulses[star.id],
        bare,
        onPrev: prev,
        onNext: next,
        onClose,
      };
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
