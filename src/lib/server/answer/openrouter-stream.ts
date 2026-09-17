// One streaming chat completion against OpenRouter, yielded as content
// deltas. Same endpoint, headers and reasoning switch-off as V2's
// non-streaming call (see ../flight/openrouter.ts); the response is parsed
// as SSE because the free endpoints support no tools or JSON mode. The
// request carries a free-only `models` chain, so OpenRouter moves to the next
// model when one is rate-limited or down.

import { OPENROUTER_URL } from "@/lib/server/flight/openrouter";
import { resolveModelChain } from "@/lib/server/models";
import { SITE_TITLE, SITE_URL } from "@/lib/server/site";
import { parseChunk, SseParser } from "./sse";

/** Overall budget for connect plus the whole stream; the chain may try several models. */
export const DEFAULT_STREAM_TIMEOUT_MS = 14_000;
/** Some free models write a visible thinking preamble before the protocol lines. */
export const DEFAULT_STREAM_MAX_TOKENS = 1500;
export const DEFAULT_TEMPERATURE = 0.2;

export type StreamFailure =
  | "timeout"
  | "aborted"
  | "network"
  | "http_429"
  | "http_5xx"
  | "http_other"
  | "malformed";

export class ModelStreamError extends Error {
  constructor(
    readonly reason: StreamFailure,
    readonly status?: number,
  ) {
    super(status ? `${reason} (${status})` : reason);
    this.name = "ModelStreamError";
  }
}

export interface StreamOptions {
  apiKey: string;
  /** Model ids in priority order; anything that is not ":free" is dropped. */
  models: readonly string[];
  systemPrompt: string;
  question: string;
  fetchImpl: typeof fetch;
  /** Overall budget for the whole stream, connect included. */
  timeoutMs: number;
  maxTokens: number;
  /** Aborting it ends the stream early, for example when the client left. */
  signal?: AbortSignal;
  /** Called once with the model that actually answered, as the response reports it. */
  onModel?: (model: string) => void;
}

export function buildStreamRequestBody(
  opts: Pick<StreamOptions, "models" | "systemPrompt" | "question" | "maxTokens">,
) {
  const models = resolveModelChain(opts.models);
  return {
    model: models[0],
    models,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.question },
    ],
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: opts.maxTokens,
    reasoning: { effort: "none", exclude: true },
    stream: true,
  };
}

function reasonForStatus(status: number | undefined): StreamFailure {
  if (status === 429) return "http_429";
  if (status !== undefined && status >= 500) return "http_5xx";
  return "http_other";
}

/**
 * Yields content deltas until [DONE], the body ends, or the caller stops
 * iterating. Throws ModelStreamError on any failure; a stream that ends
 * without ever carrying content is "malformed".
 */
export async function* streamOpenRouter(opts: StreamOptions): AsyncGenerator<string, void, undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const onOuterAbort = () => controller.abort();
  if (opts.signal?.aborted) controller.abort();
  else opts.signal?.addEventListener("abort", onOuterAbort, { once: true });
  const abortReason = (): StreamFailure =>
    opts.signal?.aborted ? "aborted" : controller.signal.aborted ? "timeout" : "network";

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    let response: Response;
    try {
      response = await opts.fetchImpl(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "HTTP-Referer": SITE_URL,
          "X-Title": SITE_TITLE,
        },
        body: JSON.stringify(buildStreamRequestBody(opts)),
        signal: controller.signal,
      });
    } catch {
      throw new ModelStreamError(abortReason());
    }

    if (response.status === 429) throw new ModelStreamError("http_429", 429);
    if (response.status >= 500) throw new ModelStreamError("http_5xx", response.status);
    if (!response.ok) throw new ModelStreamError("http_other", response.status);
    if (!response.body) throw new ModelStreamError("malformed");

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    const sse = new SseParser();
    let sawContent = false;
    let reportedModel = false;
    for (;;) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch {
        throw new ModelStreamError(abortReason());
      }
      const events = result.done
        ? [...sse.push(decoder.decode()), ...sse.flush()]
        : sse.push(decoder.decode(result.value, { stream: true }));
      for (const event of events) {
        if (event.kind === "done") return;
        const chunk = parseChunk(event.data);
        if (!chunk) continue;
        if (chunk.error) throw new ModelStreamError(reasonForStatus(chunk.error.code), chunk.error.code);
        if (chunk.model && !reportedModel) {
          reportedModel = true;
          opts.onModel?.(chunk.model);
        }
        if (chunk.content) {
          sawContent = true;
          yield chunk.content;
        }
      }
      if (result.done) {
        if (!sawContent) throw new ModelStreamError("malformed");
        return;
      }
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onOuterAbort);
    if (reader) reader.cancel().catch(() => {});
    controller.abort();
  }
}
