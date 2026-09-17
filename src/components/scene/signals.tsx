"use client";

// The scene reads its signals through this hook rather than useFlight()
// directly, so the dev harness can drive V3 signals (intro, beams, narration,
// views, pulses, tour) that the flight provider only sets from real answers.
// In production nothing renders SignalsOverride and this is exactly useFlight().

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useFlight } from "@/lib/flight-state";

export type FlightSignals = ReturnType<typeof useFlight>;

const OverrideContext = createContext<Partial<FlightSignals> | null>(null);

export function SignalsOverride({
  value,
  children,
}: {
  value: Partial<FlightSignals>;
  children: ReactNode;
}) {
  return <OverrideContext.Provider value={value}>{children}</OverrideContext.Provider>;
}

export function useSignals(): FlightSignals {
  const flight = useFlight();
  const override = useContext(OverrideContext);
  return useMemo(() => (override ? { ...flight, ...override } : flight), [flight, override]);
}
