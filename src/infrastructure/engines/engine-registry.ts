import { type CatalogueFile, catalogueFileSchema } from "../content-files/symptom-catalogues/symptom-catalogue-wire.ts";

export const ENGINE_REGISTRY: CatalogueFile["engines"] = catalogueFileSchema.shape.engines.parse([
  { name: "walker", mechanism: "audit" },
  { name: "eslint", mechanism: "eslint" },
]);
