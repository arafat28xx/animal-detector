import { identifyWithClaude } from "./claude";
import { identifyPlant, matchGbif, wikipediaSummary } from "./sources";
import type { Candidate, Category, IdentifyResponse, IdentifyResult } from "./types";

interface Env {
  ANTHROPIC_API_KEY: string;
  PLANTNET_API_KEY?: string;
  CLAUDE_MODEL: string;
}

// About 6 MB of JPEG once decoded; the app sends ~1 MB.
const MAX_BASE64_LENGTH = 8_000_000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({ ok: true, service: "animal-detector-api" });
    }
    if (request.method !== "POST" || url.pathname !== "/identify") {
      return json({ ok: false, error: "Not found" }, 404);
    }

    let body: { image?: unknown; category?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Body must be JSON." }, 400);
    }
    const image = typeof body.image === "string" ? body.image : "";
    const category: Category =
      body.category === "plant" || body.category === "animal" ? body.category : "auto";
    if (!image || image.length > MAX_BASE64_LENGTH) {
      return json({ ok: false, error: "Send a JPEG photo under 6 MB." }, 400);
    }

    try {
      const result = await identify(env, image, category);
      return json({ ok: true, result });
    } catch (err) {
      console.error("identify failed", err);
      return json({ ok: false, error: "Could not identify this photo. Please try again." }, 502);
    }
  },
};

async function identify(env: Env, imageBase64: string, category: Category): Promise<IdentifyResult> {
  let plantNetHints: Candidate[] = [];
  if (category === "plant" && env.PLANTNET_API_KEY) {
    const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    plantNetHints = await identifyPlant(env.PLANTNET_API_KEY, bytes).catch(() => []);
  }

  const answer = await identifyWithClaude({
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.CLAUDE_MODEL,
    imageBase64,
    category,
    plantNetHints,
  });

  const sources = ["Claude (AI)"];
  if (plantNetHints.length > 0) sources.push("Pl@ntNet");

  const base: IdentifyResult = {
    kind: answer.kind,
    scientificName: answer.scientificName,
    commonName: answer.commonName,
    confidence: clamp01(answer.confidence),
    alternatives: answer.alternatives
      .slice(0, 3)
      .map((a) => ({ ...a, confidence: clamp01(a.confidence) })),
    taxonomy: {},
    verified: false,
    description: answer.description,
    habitat: answer.habitat,
    nativeRange: answer.nativeRange,
    size: answer.size,
    diet: answer.diet,
    lifespan: answer.lifespan,
    conservationStatus: answer.conservationStatus,
    safety: {
      venomous: answer.venomous,
      toxic: answer.toxic,
      invasive: answer.invasive,
      notes: answer.safetyNotes,
    },
    funFacts: answer.funFacts.slice(0, 4),
    sources,
  };

  if (answer.kind === "none" || !answer.scientificName) return base;

  const [gbif, wiki] = await Promise.all([
    matchGbif(answer.scientificName).catch(() => null),
    wikipediaSummary(answer.scientificName).catch(() => null),
  ]);

  if (gbif) {
    base.taxonomy = gbif.taxonomy;
    base.verified = gbif.verified;
    base.gbifUrl = gbif.gbifUrl;
    if (gbif.scientificName) base.scientificName = gbif.scientificName;
    if (gbif.verified) sources.push("GBIF");
  }
  if (wiki) {
    base.description = wiki.extract;
    base.wikipediaUrl = wiki.url;
    base.referenceImageUrl = wiki.imageUrl;
    sources.push("Wikipedia");
  }
  return base;
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

function json(body: IdentifyResponse | Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
