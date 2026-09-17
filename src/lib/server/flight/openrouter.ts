// One plain-text chat completion against OpenRouter. The free GLM endpoint
// supports no tools, response_format or structured outputs, so the reply is
// parsed as text. Reasoning is switched off explicitly: the endpoint reports
// `reasoning: { default_enabled: true, default_effort: "high", mandatory: false }`,
// and OpenRouter's unified `reasoning` parameter documents `effort: "none"` as
// "disables reasoning entirely" with `exclude: true` keeping any residual
// reasoning out of the response (https://openrouter.ai/docs/use-cases/reasoning-tokens).

import { SITE_TITLE, SITE_URL } from "@/lib/server/site";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "z-ai/glm-5.2:free";
export const DEFAULT_TIMEOUT_MS = 8000;
/** Small, but with headroom in case the provider still emits some reasoning. */
export const DEFAULT_MAX_TOKENS = 400;

export type ModelFailure =
  | "timeout"
  | "network"
  | "http_429"
  | "http_5xx"
  | "http_other"
  | "malformed";

export type ModelCallResult =
  | { ok: true; text: string }
  | { ok: false; reason: ModelFailure; status?: number };

export interface ModelCallOptions {
  apiKey: string;
  model: string;
  systemPrompt: string;
  question: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  maxTokens: number;
}

export function buildRequestBody(opts: Pick<ModelCallOptions, "model" | "systemPrompt" | "question" | "maxTokens">) {
  return {
    model: opts.model,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.question },
    ],
    temperature: 0,
    max_tokens: opts.maxTokens,
    reasoning: { effort: "none", exclude: true },
    stream: false,
  };
}

export async function callOpenRouter(opts: ModelCallOptions): Promise<ModelCallResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    let response: Response;
    try {
      response = await opts.fetchImpl(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": SITE_URL,
          "X-Title": SITE_TITLE,
        },
        body: JSON.stringify(buildRequestBody(opts)),
        signal: controller.signal,
      });
    } catch (error) {
      return { ok: false, reason: isAbort(error) ? "timeout" : "network" };
    }

    if (response.status === 429) return { ok: false, reason: "http_429", status: 429 };
    if (response.status >= 500) return { ok: false, reason: "http_5xx", status: response.status };
    if (!response.ok) return { ok: false, reason: "http_other", status: response.status };

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      return { ok: false, reason: isAbort(error) ? "timeout" : "malformed" };
    }
    const text = extractContent(body);
    if (text === null) return { ok: false, reason: "malformed" };
    return { ok: true, text };
  } finally {
    clearTimeout(timer);
  }
}

function isAbort(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/** choices[0].message.content as a string, or null when the shape is wrong. */
function extractContent(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as { message?: { content?: unknown } } | null;
  const content = first?.message?.content;
  return typeof content === "string" ? content : null;
}
