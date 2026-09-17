import { describe, expect, it } from "vitest";
import { buildRequestBody } from "@/lib/server/flight/openrouter";
import { buildStreamRequestBody } from "@/lib/server/answer/openrouter-stream";
import {
  DEFAULT_MODELS,
  MAX_MODELS,
  freeOnly,
  isFreeModel,
  modelChainFromEnv,
  resolveModelChain,
} from "@/lib/server/models";

describe("free-only model chain", () => {
  it("ships three free models in priority order", () => {
    expect(DEFAULT_MODELS).toEqual(["z-ai/glm-5.2:free", "nvidia/nemotron-3.5-lightning:free", "nex-agi/nex-n2.5-pro:free"]);
    for (const id of DEFAULT_MODELS) expect(isFreeModel(id)).toBe(true);
  });

  it("recognizes only ids that end with :free", () => {
    expect(isFreeModel("z-ai/glm-5.2:free")).toBe(true);
    expect(isFreeModel("openai/gpt-5")).toBe(false);
    expect(isFreeModel("openai/gpt-5:free-ish")).toBe(false);
    expect(isFreeModel("z-ai/glm-5.2:free extra")).toBe(false);
    expect(isFreeModel(":free")).toBe(false);
    expect(isFreeModel("")).toBe(false);
  });

  it("drops paid ids, trims, deduplicates and caps the chain", () => {
    expect(freeOnly(["openai/gpt-5", " z-ai/glm-5.2:free ", "anthropic/claude-sonnet-4.5", "z-ai/glm-5.2:free", ""])).toEqual([
      "z-ai/glm-5.2:free",
    ]);
    const many = Array.from({ length: MAX_MODELS + 3 }, (_, i) => `vendor/model-${i}:free`);
    expect(freeOnly(many)).toHaveLength(MAX_MODELS);
  });

  it("resolves a comma-separated override and falls back to the defaults when nothing free is left", () => {
    expect(resolveModelChain("nvidia/nemotron-3.5-lightning:free, z-ai/glm-5.2:free")).toEqual([
      "nvidia/nemotron-3.5-lightning:free",
      "z-ai/glm-5.2:free",
    ]);
    expect(resolveModelChain("openai/gpt-5, anthropic/claude-sonnet-4.5")).toEqual([...DEFAULT_MODELS]);
    expect(resolveModelChain("")).toEqual([...DEFAULT_MODELS]);
    expect(resolveModelChain(undefined)).toEqual([...DEFAULT_MODELS]);
    expect(resolveModelChain(null)).toEqual([...DEFAULT_MODELS]);
    expect(resolveModelChain(["openai/gpt-5"])).toEqual([...DEFAULT_MODELS]);
  });

  it("reads OPENROUTER_MODELS before OPENROUTER_MODEL and ignores paid values", () => {
    expect(modelChainFromEnv({ OPENROUTER_MODELS: "nex-agi/nex-n2.5-pro:free", OPENROUTER_MODEL: "z-ai/glm-5.2:free" })).toEqual([
      "nex-agi/nex-n2.5-pro:free",
    ]);
    expect(modelChainFromEnv({ OPENROUTER_MODEL: "z-ai/glm-5.2:free" })).toEqual(["z-ai/glm-5.2:free"]);
    expect(modelChainFromEnv({ OPENROUTER_MODELS: "openai/gpt-5" })).toEqual([...DEFAULT_MODELS]);
    expect(modelChainFromEnv({})).toEqual([...DEFAULT_MODELS]);
  });

  it("makes a paid model impossible in both request builders", () => {
    const common = { systemPrompt: "s", question: "q", maxTokens: 100 };
    const flight = buildRequestBody({ ...common, model: "openai/gpt-5", models: ["openai/gpt-5", "anthropic/claude-sonnet-4.5"] });
    expect(flight.model).toBe(DEFAULT_MODELS[0]);
    expect(flight.models).toEqual([...DEFAULT_MODELS]);
    expect(buildRequestBody({ ...common, model: "openai/gpt-5" }).models).toEqual([...DEFAULT_MODELS]);
    expect(buildRequestBody({ ...common, model: "z-ai/glm-5.2:free" })).toMatchObject({
      model: "z-ai/glm-5.2:free",
      models: ["z-ai/glm-5.2:free"],
    });

    const stream = buildStreamRequestBody({ ...common, models: ["openai/gpt-5", "nex-agi/nex-n2.5-pro:free"] });
    expect(stream.model).toBe("nex-agi/nex-n2.5-pro:free");
    expect(stream.models).toEqual(["nex-agi/nex-n2.5-pro:free"]);
    expect(buildStreamRequestBody({ ...common, models: [] }).models).toEqual([...DEFAULT_MODELS]);
    expect("route" in stream).toBe(false);
  });
});
