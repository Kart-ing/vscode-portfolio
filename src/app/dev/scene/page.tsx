// Development-only harness for the 3D scene. Production serves a 404.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevHarness } from "@/components/scene/DevHarness";

export const metadata: Metadata = {
  title: "Scene harness",
  robots: { index: false, follow: false },
};

export default function SceneDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevHarness />;
}
