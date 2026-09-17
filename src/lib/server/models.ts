// The OpenRouter model chain, free models only. The key belongs to a free-tier
// account and the owner never spends money, so every id must end with ":free";
// anything else is dropped before a request is built, whatever the env says.
// OpenRouter tries the `models` array in order when a model is rate-limited,
// down, or refuses (https://openrouter.ai/docs/guides/routing/model-fallbacks).

export const FREE_SUFFIX = ":free";

export const DEFAULT_MODELS: readonly string[] = [
  "z-ai/glm-5.2:free",
  "nvidia/nemotron-3.5-lightning:free",
  "nex-agi/nex-n2.5-pro:free",
];

/** Longest chain sent in one request. */
export const MAX_MODELS = 5;

export function isFreeModel(id: string): boolean {
  return id.length > FREE_SUFFIX.length && id.endsWith(FREE_SUFFIX) && !/\s/.test(id);
}

/** Trims, deduplicates and keeps only ":free" ids, in order. */
export function freeOnly(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!isFreeModel(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= MAX_MODELS) break;
  }
  return out;
}

/**
 * The chain to send: the free ids from `raw` (a comma-separated string or a
 * list), or DEFAULT_MODELS when nothing free is left. Never empty.
 */
export function resolveModelChain(raw?: string | readonly string[] | null): string[] {
  const ids = typeof raw === "string" ? raw.split(",") : (raw ?? []);
  const chain = freeOnly(ids);
  return chain.length > 0 ? chain : [...DEFAULT_MODELS];
}

/** OPENROUTER_MODELS (comma-separated) wins over V2's OPENROUTER_MODEL. */
export function modelChainFromEnv(env: Readonly<Record<string, string | undefined>> = process.env): string[] {
  return resolveModelChain(env.OPENROUTER_MODELS?.trim() || env.OPENROUTER_MODEL?.trim() || undefined);
}
