import { z } from "zod";
import { SYSTEM, VisionAnswer } from "./claude";
import type { Candidate, Category } from "./types";

// Free alternative to Claude: a vision model on Cloudflare Workers AI.
// Used when no ANTHROPIC_API_KEY is set. Less accurate, but costs nothing
// within the Workers AI free daily allowance.
const RESPONSE_SCHEMA = z.toJSONSchema(VisionAnswer);

export async function identifyWithWorkersAI(opts: {
  ai: Ai;
  model: string;
  imageBase64: string;
  category: Category;
  plantNetHints: Candidate[];
}): Promise<VisionAnswer> {
  let prompt = "Identify the organism in this photo. Reply with JSON only.";
  if (opts.category !== "auto") {
    prompt += ` The user says it is a ${opts.category}.`;
  }
  if (opts.plantNetHints.length > 0) {
    const hints = opts.plantNetHints
      .map((c) => `${c.scientificName} (${Math.round(c.confidence * 100)}%)`)
      .join(", ");
    prompt += ` A specialist plant classifier suggested: ${hints}. Prefer its top answer unless the photo clearly contradicts it.`;
  }

  const response = (await opts.ai.run(opts.model as keyof AiModels, {
    max_tokens: 4000,
    response_format: {
      type: "json_schema",
      json_schema: { name: "identification", schema: RESPONSE_SCHEMA, strict: true },
    },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${opts.imageBase64}` } },
          { type: "text", text: prompt },
        ],
      },
    ],
  } as never)) as {
    choices?: { message?: { content?: string | null } }[];
    response?: unknown;
  };

  const raw = response.choices?.[0]?.message?.content ?? response.response;
  const parsed = typeof raw === "string" ? JSON.parse(stripFences(raw)) : raw;
  const result = VisionAnswer.safeParse(parsed);
  if (!result.success) {
    throw new Error("The identification service returned an unexpected answer.");
  }
  return result.data;
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
