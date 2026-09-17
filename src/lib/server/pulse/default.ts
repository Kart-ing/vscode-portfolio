// The one pulse source a server process uses. Its 15-minute cache lives for
// the life of the process.

import { record } from "@/content/record";
import { createPulseSource, type PulseSource } from "./github";

let instance: PulseSource | undefined;

export function getDefaultPulseSource(): PulseSource {
  instance ??= createPulseSource({ record });
  return instance;
}
