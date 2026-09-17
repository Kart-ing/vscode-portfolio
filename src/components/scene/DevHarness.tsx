"use client";

// Development harness entry. The inner harness reads window at first render,
// so it is loaded client-only.

import dynamic from "next/dynamic";

const Harness = dynamic(() => import("./DevHarnessInner").then((m) => m.DevHarnessInner), {
  ssr: false,
});

export function DevHarness() {
  return <Harness />;
}
