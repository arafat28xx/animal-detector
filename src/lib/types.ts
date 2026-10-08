// Keep in sync with backend/src/types.ts.

export type Category = "auto" | "plant" | "animal";

export interface Candidate {
  scientificName: string;
  commonName: string;
  confidence: number;
}

export interface Taxonomy {
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
}

export interface IdentifyResult {
  kind: "animal" | "plant" | "fungus" | "other" | "none";
  scientificName: string;
  commonName: string;
  /** 0 to 1 */
  confidence: number;
  alternatives: Candidate[];
  taxonomy: Taxonomy;
  /** True when GBIF recognised the scientific name. */
  verified: boolean;
  gbifUrl?: string;
  description: string;
  wikipediaUrl?: string;
  referenceImageUrl?: string;
  habitat: string;
  nativeRange: string;
  size: string;
  diet: string;
  lifespan: string;
  conservationStatus: string;
  safety: {
    venomous: boolean;
    toxic: boolean;
    invasive: boolean;
    notes: string;
  };
  funFacts: string[];
  sources: string[];
}

export type IdentifyResponse =
  | { ok: true; result: IdentifyResult }
  | { ok: false; error: string };
