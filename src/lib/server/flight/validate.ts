// Request validation. Anything invalid becomes the empty plan with HTTP 200;
// the visitor never sees an error. Only `question` is read from the body, so
// client-supplied history or plans are ignored by construction.

import { MAX_QUESTION_CHARS, type FlightPlan } from "@/lib/contract";

export const EMPTY_PLAN: Readonly<FlightPlan> = Object.freeze({
  question: "",
  stops: [],
  mode: "none",
});

/** Largest request body we bother to parse, in UTF-16 code units. */
const MAX_BODY_CHARS = 8192;

/** Trims and collapses whitespace; null unless the result is 1..MAX_QUESTION_CHARS. */
export function cleanQuestion(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned.length < 1 || cleaned.length > MAX_QUESTION_CHARS) return null;
  return cleaned;
}

/** Reads `question` from a JSON body. Returns null for bad JSON or a missing field. */
export async function readQuestion(request: Request): Promise<unknown> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return null;
  }
  if (text.length > MAX_BODY_CHARS) return null;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (!("question" in body)) return null;
  return (body as { question: unknown }).question;
}
