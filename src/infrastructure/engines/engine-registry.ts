import type { Engine } from "../../domain/language-layer/symptom-catalogue.ts";
import { ENGINE_IDS } from "../../domain/rule-set/identifier-types.ts";

export const ENGINE_REGISTRY: Engine[] = ENGINE_IDS.map((name) => ({ name }));
