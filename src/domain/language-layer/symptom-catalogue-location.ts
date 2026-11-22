import type { AddressedCheck } from "./check-address-text.ts";

export const SYMPTOM_CATALOGUE_SEGMENTS: readonly string[] = ["rules"];

export const CHECK_ITEMS_SEGMENTS: readonly string[] = [...SYMPTOM_CATALOGUE_SEGMENTS, "typescript", "symptoms"];

export const checkItemSegments = (request: { readonly check: AddressedCheck }): readonly string[] => [
  ...CHECK_ITEMS_SEGMENTS,
  request.check.symptom.name,
  `${request.check.name}.md`,
];
