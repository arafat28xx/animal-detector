import type { Candidate, Taxonomy } from "./types";

const USER_AGENT = "AnimalDetector/1.0 (https://github.com/arafat28xx/animal-detector)";
const DAY = 60 * 60 * 24;

/** Pl@ntNet: specialist plant identification. Returns up to 5 candidates. */
export async function identifyPlant(apiKey: string, image: Uint8Array): Promise<Candidate[]> {
  const form = new FormData();
  form.append("organs", "auto");
  form.append("images", new Blob([image], { type: "image/jpeg" }), "photo.jpg");

  const url =
    "https://my-api.plantnet.org/v2/identify/all?nb-results=5&lang=en&api-key=" +
    encodeURIComponent(apiKey);
  const res = await fetch(url, { method: "POST", body: form });
  // 404 means Pl@ntNet found no plant in the photo.
  if (!res.ok) return [];

  const data = (await res.json()) as {
    results?: {
      score: number;
      species: { scientificNameWithoutAuthor: string; commonNames?: string[] };
    }[];
  };
  return (data.results ?? []).map((r) => ({
    scientificName: r.species.scientificNameWithoutAuthor,
    commonName: r.species.commonNames?.[0] ?? "",
    confidence: r.score,
  }));
}

export interface GbifMatch {
  verified: boolean;
  scientificName?: string;
  taxonomy: Taxonomy;
  gbifUrl?: string;
}

/** GBIF: checks the name is a real taxon and returns its classification. */
export async function matchGbif(name: string): Promise<GbifMatch> {
  const res = await fetch(
    "https://api.gbif.org/v1/species/match?name=" + encodeURIComponent(name),
    { headers: { "User-Agent": USER_AGENT }, cf: { cacheTtl: 30 * DAY, cacheEverything: true } },
  );
  if (!res.ok) return { verified: false, taxonomy: {} };

  const m = (await res.json()) as {
    usageKey?: number;
    canonicalName?: string;
    matchType?: string;
    kingdom?: string;
    phylum?: string;
    class?: string;
    order?: string;
    family?: string;
    genus?: string;
  };
  const taxonomy: Taxonomy = {
    kingdom: m.kingdom,
    phylum: m.phylum,
    class: m.class,
    order: m.order,
    family: m.family,
    genus: m.genus,
  };
  const verified = m.matchType === "EXACT" || m.matchType === "FUZZY";
  return {
    verified,
    scientificName: verified ? m.canonicalName : undefined,
    taxonomy,
    gbifUrl: m.usageKey ? `https://www.gbif.org/species/${m.usageKey}` : undefined,
  };
}

export interface WikiSummary {
  extract: string;
  url?: string;
  imageUrl?: string;
}

/** Wikipedia: short human-written summary and a reference photo. */
export async function wikipediaSummary(title: string): Promise<WikiSummary | null> {
  const res = await fetch(
    "https://en.wikipedia.org/api/rest_v1/page/summary/" +
      encodeURIComponent(title.replace(/ /g, "_")),
    { headers: { "User-Agent": USER_AGENT }, cf: { cacheTtl: 7 * DAY, cacheEverything: true } },
  );
  if (!res.ok) return null;

  const s = (await res.json()) as {
    type?: string;
    extract?: string;
    thumbnail?: { source: string };
    content_urls?: { mobile?: { page: string }; desktop?: { page: string } };
  };
  if (s.type === "disambiguation" || !s.extract) return null;
  return {
    extract: s.extract,
    url: s.content_urls?.mobile?.page ?? s.content_urls?.desktop?.page,
    imageUrl: s.thumbnail?.source,
  };
}
