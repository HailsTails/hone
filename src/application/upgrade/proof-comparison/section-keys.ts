export const PROOF_SECTIONS = [
  "excluded",
  "findings",
  "answered",
  "unrecorded",
  "misnamed",
  "paid",
  "stale",
  "forfeited",
  "doubly-held",
  "invalid-records",
  "uncovered",
  "not-adopted",
  "not-run",
  "editions",
  "unmeasured",
  "projection-problems",
  "assessment",
  "verdict",
] as const;

export type ProofSection = (typeof PROOF_SECTIONS)[number];

export type SectionKeys = Readonly<Record<ProofSection, readonly string[]>>;

export const uniqueKeys = (request: { readonly keys: readonly string[] }): readonly string[] => [...new Set(request.keys)];

export const joinedKey = (request: { readonly parts: readonly (string | number)[] }): string => request.parts.join(" ");
