import type { Check, Engine, Symptom, SymptomCatalogue } from "../src/domain/language-layer/symptom-catalogue.ts";
import { clauseAddressSchema } from "../src/infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../src/infrastructure/hone-config-file/identifiers.ts";
import { SETTINGS_CATALOGUE } from "./settings-catalogue.ts";

const WALKER: Engine = { name: "walker", mechanism: mechanismIdSchema.parse("audit") };

const ESLINT: Engine = { name: "eslint", mechanism: mechanismIdSchema.parse("eslint") };

const SYMPTOM: Omit<Symptom, "name" | "title"> = { seen: "a site", mayIndicate: [], breachUsuallySits: "in the unit", recipes: [], correctUses: [] };

const TEST_SWITCHED_OFF: Symptom = { ...SYMPTOM, name: "test-switched-off", title: "Test switched off" };

const CLAIMED_TYPE: Symptom = { ...SYMPTOM, name: "claimed-type", title: "Claimed type" };

const POSITIONAL_PARAMETERS: Symptom = { ...SYMPTOM, name: "positional-parameters", title: "Positional parameters" };

const REBINDING: Symptom = { ...SYMPTOM, name: "rebinding", title: "Rebinding" };

export const SKIPPED_TESTS_CHECK: Check = {
  name: "skipped-tests",
  symptom: TEST_SWITCHED_OFF,
  clause: clauseAddressSchema.parse("CD-27#skipped-tests"),
  engines: [ESLINT],
  forms: [],
};

export const NON_NULL_ASSERTIONS_CHECK: Check = {
  name: "non-null-assertions",
  symptom: CLAIMED_TYPE,
  clause: clauseAddressSchema.parse("CD-2#non-null-assertions"),
  engines: [ESLINT],
  forms: [],
};

export const PARAMETER_COUNT_CHECK: Check = {
  name: "parameter-count",
  symptom: POSITIONAL_PARAMETERS,
  clause: clauseAddressSchema.parse("CD-40#parameter-count"),
  engines: [ESLINT],
  forms: [],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  clause: clauseAddressSchema.parse("CD-27#test-body-logic"),
  engines: [WALKER],
  forms: ["a-let"],
};

export const CHECKS_PLUGIN_CATALOGUE: SymptomCatalogue = {
  ...SETTINGS_CATALOGUE,
  engines: [WALKER, ESLINT],
  symptoms: [TEST_SWITCHED_OFF, CLAIMED_TYPE, POSITIONAL_PARAMETERS, REBINDING],
  clauses: [],
  checks: [SKIPPED_TESTS_CHECK, NON_NULL_ASSERTIONS_CHECK, PARAMETER_COUNT_CHECK, REBINDING_TEST_BODY],
};
