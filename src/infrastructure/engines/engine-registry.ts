import type { Engine } from "../../domain/language-layer/symptom-catalogue.ts";

export const ENGINE_REGISTRY: Engine[] = [
  { name: "walker" },
  { name: "eslint" },
  { name: "oxlint" },
];
