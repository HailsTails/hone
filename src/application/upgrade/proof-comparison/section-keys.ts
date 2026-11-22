import type { ProofSection } from "../../ports/upgrade/proof-outcome.ts";

export type SectionKeys = Readonly<Record<ProofSection, readonly string[]>>;

export const uniqueKeys = (request: { readonly keys: readonly string[] }): readonly string[] => [
  ...new Set(request.keys),
];

export const joinedKey = (request: { readonly parts: readonly (string | number)[] }): string =>
  request.parts.join(" ");
