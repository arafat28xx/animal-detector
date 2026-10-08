import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Category, Candidate } from "./types";

const VisionAnswer = z.object({
  kind: z.enum(["animal", "plant", "fungus", "other", "none"]),
  scientificName: z.string(),
  commonName: z.string(),
  confidence: z.number(),
  alternatives: z.array(
    z.object({
      scientificName: z.string(),
      commonName: z.string(),
      confidence: z.number(),
    }),
  ),
  description: z.string(),
  habitat: z.string(),
  nativeRange: z.string(),
  size: z.string(),
  diet: z.string(),
  lifespan: z.string(),
  conservationStatus: z.string(),
  venomous: z.boolean(),
  toxic: z.boolean(),
  invasive: z.boolean(),
  safetyNotes: z.string(),
  funFacts: z.array(z.string()),
});

export type VisionAnswer = z.infer<typeof VisionAnswer>;

const SYSTEM = `You identify animals, plants and fungi from photos for a nature app.
Return the most specific taxon you can support from what is visible: species if you are confident, otherwise genus or family. Never invent a scientific name; use accepted binomial names.
confidence is your honest probability (0 to 1) that scientificName is correct. Give up to 3 alternatives that look similar.
If no living organism is visible, set kind to "none" and leave the text fields empty.
Fill the info fields in plain, friendly English, one or two sentences each. Use an empty string when a field does not apply (for example diet for a plant) or is unknown.
conservationStatus should be the IUCN category if you know it (for example "Least Concern"), otherwise an empty string.
venomous, toxic and invasive describe risks to people or pets; explain any risk in safetyNotes. Be conservative: if a look-alike is dangerous, say so.
funFacts: 2 to 4 short, true facts.`;

export async function identifyWithClaude(opts: {
  apiKey: string;
  model: string;
  imageBase64: string;
  category: Category;
  plantNetHints: Candidate[];
}): Promise<VisionAnswer> {
  const client = new Anthropic({ apiKey: opts.apiKey });

  let prompt = "Identify the organism in this photo.";
  if (opts.category !== "auto") {
    prompt += ` The user says it is a ${opts.category}.`;
  }
  if (opts.plantNetHints.length > 0) {
    const hints = opts.plantNetHints
      .map((c) => `${c.scientificName} (${Math.round(c.confidence * 100)}%)`)
      .join(", ");
    prompt += ` A specialist plant classifier suggested: ${hints}. Prefer its top answer unless the photo clearly contradicts it.`;
  }

  const response = await client.messages.parse({
    model: opts.model,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: {
      effort: "low",
      format: zodOutputFormat(VisionAnswer),
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: opts.imageBase64 },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The photo could not be analysed.");
  }
  if (!response.parsed_output) {
    throw new Error("The identification service returned an unexpected answer.");
  }
  return response.parsed_output;
}
