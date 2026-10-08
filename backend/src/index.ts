import { identifyWithClaude } from "./claude";
import { identifyPlant, matchGbif, wikipediaSummary } from "./sources";
import { identifyWithWorkersAI } from "./workersai";
import type { Candidate, Category, IdentifyResponse, IdentifyResult } from "./types";

interface Env {
  /** Optional. Without it the free Workers AI model is used instead of Claude. */
  ANTHROPIC_API_KEY?: string;
  PLANTNET_API_KEY?: string;
  CLAUDE_MODEL: string;
  WORKERS_AI_MODEL: string;
  AI: Ai;
}

// About 6 MB of JPEG once decoded; the app sends ~1 MB.
const MAX_BASE64_LENGTH = 8_000_000;
// The app gives up after 45 s, so answer with an error before that rather than hang.
const AI_TIMEOUT_MS = 40_000;
// The free model occasionally stalls for a minute or more. If it hasn't answered
// by then, send a second identical request and use whichever finishes first.
const HEDGE_AFTER_MS = 12_000;

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

  const answer = await withTimeout(
    env.ANTHROPIC_API_KEY
      ? identifyWithClaude({
          apiKey: env.ANTHROPIC_API_KEY,
          model: env.CLAUDE_MODEL,
          imageBase64,
          category,
          plantNetHints,
        })
      : hedged(
          () =>
            identifyWithWorkersAI({
              ai: env.AI,
              model: env.WORKERS_AI_MODEL,
              imageBase64,
              category,
              plantNetHints,
            }),
          HEDGE_AFTER_MS,
        ),
    AI_TIMEOUT_MS,
  );

  const sources = [env.ANTHROPIC_API_KEY ? "Claude (AI)" : "Gemma (AI)"];
  if (plantNetHints.length > 0) sources.push("Pl@ntNet");

  const base: IdentifyResult = {
    kind: answer.kind,
    scientificName: answer.scientificName,
    commonName: answer.commonName,
    confidence: clamp01(answer.confidence),
    alternatives: answer.alternatives
      // Small models sometimes repeat the main answer or the same name twice.
      .filter(
        (a, i, all) =>
          a.scientificName !== answer.scientificName &&
          all.findIndex((b) => b.scientificName === a.scientificName) === i,
      )
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
    // Cultivated varieties (e.g. bok choy) often have no page under the
    // scientific name, so fall back to the common name.
    wikipediaSummary(answer.scientificName)
      .then((w) => w ?? (answer.commonName ? wikipediaSummary(answer.commonName) : null))
      .catch(() => null),
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

function hedged<T>(run: () => Promise<T>, delayMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let failures = 0;
    let attempts = 0;
    let settled = false;
    const start = () => {
      attempts++;
      run().then(
        (value) => {
          settled = true;
          resolve(value);
        },
        (err) => {
          failures++;
          // Retry at once if the first attempt failed before the backup started.
          if (attempts === 1) {
            clearTimeout(timer);
            start();
          } else if (failures === attempts) {
            reject(err);
          }
        },
      );
    };
    const timer = setTimeout(() => !settled && attempts === 1 && start(), delayMs);
    start();
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Identification timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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
