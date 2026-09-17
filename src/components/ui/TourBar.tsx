"use client";

// Controls for the guided tour: pause and resume, previous and next, exit,
// and a slim progress bar that fills across the current step's hold.

import { tour as steps } from "@/content/scripts";
import { useFlight } from "@/lib/flight-state";

export function TourBar({ reduced }: { reduced: boolean }) {
  const { tour, pauseTour, resumeTour, nextTourStep, prevTourStep, stopTour } = useFlight();
  if (!tour.active) return null;
  const total = Math.max(tour.total, 1);
  const from = (tour.index / total) * 100;
  const to = ((tour.index + 1) / total) * 100;
  const hold = steps[tour.index]?.holdMs ?? 5000;

  return (
    <div className="tourbar" role="region" aria-label="Guided tour">
      <button
        type="button"
        className="tour-btn"
        onClick={tour.paused ? resumeTour : pauseTour}
        aria-label={tour.paused ? "Resume the tour" : "Pause the tour"}
      >
        {tour.paused ? (
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 1.8v8.4L10 6z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <rect x="2" y="2" width="3" height="8" rx="0.5" fill="currentColor" />
            <rect x="7" y="2" width="3" height="8" rx="0.5" fill="currentColor" />
          </svg>
        )}
      </button>
      <button type="button" className="tour-btn" onClick={prevTourStep} disabled={tour.index === 0} aria-label="Previous step">
        ←
      </button>
      <div className="tour-progress" aria-hidden="true">
        <div className="tour-rail" />
        <div
          key={tour.index}
          className={tour.paused ? "tour-fill is-paused" : reduced ? "tour-fill is-static" : "tour-fill"}
          style={
            {
              "--tour-from": `${from.toFixed(2)}%`,
              "--tour-to": `${to.toFixed(2)}%`,
              "--tour-hold": `${hold}ms`,
            } as React.CSSProperties
          }
        />
        <div className="tour-dots">
          {steps.map((step, i) => (
            <span key={i} className={i <= tour.index ? "tour-dot is-done" : "tour-dot"} />
          ))}
        </div>
      </div>
      <span className="tour-count" aria-live="polite">
        {tour.index + 1} / {total}
      </span>
      <button type="button" className="tour-btn" onClick={nextTourStep} aria-label={tour.index + 1 >= total ? "Finish the tour" : "Next step"}>
        →
      </button>
      <button type="button" className="tour-exit" onClick={stopTour}>
        <span className="key" aria-hidden="true">
          Esc
        </span>
        <span className="label">Exit tour</span>
      </button>
    </div>
  );
}
