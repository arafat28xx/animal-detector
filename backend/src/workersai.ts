import { z } from "zod";
import { SYSTEM, VisionAnswer } from "./claude";
import type { Candidate, Category } from "./types";

// Free alternative to Claude: a vision model on Cloudflare Workers AI.
// Used when no ANTHROPIC_API_KEY is set. Less accurate, but costs nothing
// within the Workers AI free daily allowance.
const RESPONSE_SCHEMA = JSON.stringify(z.toJSONSchema(VisionAnswer));

// Strict json_schema mode makes Gemma loop on whitespace until it times out,
// so ask for plain JSON and tolerate missing or mistyped fields instead.
const str = z.string().catch("");
const num = z.number().catch(0);
const bool = z.boolean().catch(false);
const LenientAnswer = z.object({
  kind: VisionAnswer.shape.kind.catch("other"),
  scientificName: str,
  commonName: str,
  confidence: num,
  alternatives: z
    .array(z.object({ scientificName: str, commonName: str, confidence: num }))
    .catch([]),
  description: str,
  habitat: str,
  nativeRange: str,
  size: str,
  diet: str,
  lifespan: str,
  conservationStatus: str,
  venomous: bool,
  toxic: bool,
  invasive: bool,
  safetyNotes: str,
  funFacts: z.array(z.string()).catch([]),
});

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
    // A full answer is ~600 tokens; the cap stops a runaway answer early.
    max_tokens: 1500,
    // Thinking roughly triples response time for little gain on this task.
    chat_template_kwargs: { enable_thinking: false },
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${SYSTEM}\nReply with one JSON object matching this JSON Schema:\n${RESPONSE_SCHEMA}`,
      },
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
  const result = LenientAnswer.safeParse(parsed);
  if (!result.success || (!result.data.scientificName && result.data.kind !== "none")) {
    throw new Error("The identification service returned an unexpected answer.");
  }
  return result.data;
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
