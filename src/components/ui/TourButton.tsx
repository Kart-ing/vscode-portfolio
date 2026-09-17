"use client";

import { tour } from "@/content/scripts";
import { useFlight } from "@/lib/flight-state";

// Sits with the identity links. Rendered inside the FlightProvider tree.
export function TourButton() {
  const { startTour } = useFlight();
  if (tour.length === 0) return null;
  return (
    <button type="button" className="tour-button" onClick={startTour}>
      Take the tour
      <span aria-hidden="true">▸</span>
    </button>
  );
}
