import type { AttributedNativeException } from "../src/infrastructure/command-line/governance.ts";
import type { MisnamedRuleId } from "../src/infrastructure/engines/protocol/checks/checks-runner-types.ts";
import type { InlineReach, ScriptOptionCause } from "../src/infrastructure/engines/protocol/runner-module/runner-result-schema.ts";
import type {
  AuthorisedLocation,
  AuthorisedReach,
  BoundaryRecord,
  CatalogueNote,
  Debt,
  DependencyRecord,
  Deviation,
  HoneRecord,
  PlacedRecord,
  RecordNote,
  RecordPlace,
  RecordRefusal,
  SymptomReach,
} from "../src/infrastructure/hone-records-folder/hone-record.ts";
import type { RecordsUnmeasured } from "../src/domain/records/measurement/records-unmeasured.ts";
import { recordReferenceText, recordSubjectText } from "../src/infrastructure/printed-report/records/record-lines.ts";
import { RUN_SECTION_NAMES, type RunSectionName, runSectionRoleOf } from "../src/domain/report/report-sections.ts";
import type { EngineNotRun, RunProjectionProblem, RunReport, RunUnmeasured } from "../src/domain/report/run-report.ts";
import { renderRunReportText } from "../src/infrastructure/printed-report/run-report-text.ts";
import type { ConventionKey } from "../src/infrastructure/hone-config-file/conventions.ts";
import type { BaseRevisionAvailability } from "../src/domain/repository/base-revision-availability.ts";
import { editionSchema } from "../src/infrastructure/content-files/edition.ts";
import { repoPathSchema } from "../src/infrastructure/hone-records-folder/repo-path.ts";
import { type VersionTwoReportOutput, versionTwoReportOutputSchema } from "../src/infrastructure/hone-config-file/report-output.ts";
import { CAUSAL_WHY_CHAIN } from "./causal-why-chain.ts";
import { type DocumentedRole, type EntryFills, type Fills, type PrintedLine, sectionedLinesOf } from "./output-contract.ts";
import {
  AUDIT,
  BRANCH_IN_A_TEST,
  CAST_CHECK,
  CAST_EXPRESSIONS,
  CHECKS_PAGE,
  CLAIMED_TYPE,
  CLOCK_CHECK,
  CLOCK_SOURCES,
  DATE_USED_DIRECTLY,
  ESLINT,
  ESLINT_ENGINE,
  GIVES_A_VALUE_ITS_TYPE,
  OWED_DECLARED_NOT_ASSERTED,
  REPORT_CATALOGUE,
  SYMPTOM_PAGE,
  TEAM_CLAUSE,
  TEST_BODY_CHECK,
  TEST_BODY_LOGIC,
  WALKER,
  WHOLE_SYMPTOM,
  WORLD_VALUES_THROUGH_A_PORT,
} from "./report-catalogue.ts";

type Filled<Entry> = { readonly entry: Entry; readonly fills: Fills };

type SectionSamples = { readonly [Section in RunSectionName]: readonly Filled<RunReport[Section][number]>[] };

const PROJECT_COMMAND = "node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop";

const ORDER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const TEST_FILE = repoPathSchema.parse("src/orders/charge-order.test.ts");

const WEBHOOK_FILE = repoPathSchema.parse("src/adapters/stripe-webhook.ts");

const PACKAGE_FILE = repoPathSchema.parse("package.json");

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/claimed-type.json");

const AUTHORISED_FILE = repoPathSchema.parse("hone-records/authorised-locations/claimed-type.json");

const DEVIATIONS_FILE = repoPathSchema.parse("hone-records/deviations/world-values-through-a-port.json");

const BOUNDARIES_FILE = repoPathSchema.parse("hone-records/boundary-records.json");

const DEPENDENCIES_FILE = repoPathSchema.parse("hone-records/dependency-records.json");

const SLICE = repoPathSchema.parse("packages/web/hone.eslint.mjs");

const PRUNE_COMMAND = "node /work/shop/node_modules/@hailstails/hone/src/hone.js prune-debt --repo /work/shop";

const SHARED_FILLS: Fills = { "project command": PROJECT_COMMAND, "prune command": PRUNE_COMMAND, "symptom page": SYMPTOM_PAGE };

const WEBHOOK_FILLS: Fills = { symptom: "claimed-type", file: "src/adapters/stripe-webhook.ts" };

const STATED_DEBT: Debt = { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: WEBHOOK_FILE, holding: { held: "stated" } };

const CARRIED_DEBT: Debt = { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: WEBHOOK_FILE, holding: { held: "carried", entry: {}, lacks: [], standing: "established" } };

const MATCHED_LOCATION: AuthorisedLocation = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: WEBHOOK_FILE,
  holding: { held: "stated", owing: { matches: "the-catalogue", case: GIVES_A_VALUE_ITS_TYPE, owes: OWED_DECLARED_NOT_ASSERTED }, whyChain: CAUSAL_WHY_CHAIN },
};

const CARRIED_LOCATION: AuthorisedLocation = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: WEBHOOK_FILE,
  holding: { held: "carried", entry: {}, lacks: ["case", "owes", "whyChain"], standing: "unjudged" },
};

const UNKNOWN_CASE_LOCATION: AuthorisedLocation = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: WEBHOOK_FILE,
  holding: { held: "stated", owing: { matches: "not-the-catalogue", note: { kind: "unknown-case", case: "parses a webhook", owes: "declared-not-asserted" } }, whyChain: CAUSAL_WHY_CHAIN },
};

const UNOWED_LOCATION: AuthorisedLocation = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: WEBHOOK_FILE,
  holding: { held: "stated", owing: { matches: "not-the-catalogue", note: { kind: "owes-not-owed", case: GIVES_A_VALUE_ITS_TYPE, owes: "written-out-answers" } }, whyChain: CAUSAL_WHY_CHAIN },
};

const DEVIATION: Deviation = { kind: "deviation", recipe: WORLD_VALUES_THROUGH_A_PORT, file: WEBHOOK_FILE, reasonFails: "Fails.", evidence: "Evidence.", ruleHolds: "Holds." };

const CLOCK_BOUNDARY: BoundaryRecord = {
  kind: "boundary-record",
  module: repoPathSchema.parse("src/adapters/system-clock.ts"),
  outsideParty: { kind: "runtime", facility: "clock" },
  holding: { held: "stated", ports: ["Clock"] },
};

const FILES_BOUNDARY: BoundaryRecord = {
  kind: "boundary-record",
  module: repoPathSchema.parse("src/adapters/files"),
  outsideParty: { kind: "scheme-module", specifier: "node:fs" },
  holding: { held: "carried", entry: {}, lacks: ["ports"], standing: "established" },
};

const DEPENDENCY: DependencyRecord = { kind: "dependency-record", dependency: "zod", nativeWay: "hand-written parsing", whyNotEnough: "Not enough." };

const CAST_REACH: SymptomReach = { reaches: "one-check", check: CAST_CHECK };

const UNKNOWN_CHECK_REACH: AuthorisedReach = { reaches: "unknown-check", check: "cast-old" };

const CAST_FILLS: Fills = { check: "claimed-type#cast-expressions", file: "src/adapters/stripe-webhook.ts" };

const UNKNOWN_CHECK_FILLS: Fills = { ...WEBHOOK_FILLS, "check name": "cast-old", given: '"cast-old"' };

const UNKNOWN_CASE_WORDS: Fills = { case: '"parses a webhook"', owes: '"declared-not-asserted"' };

const UNOWED_WORDS: Fills = { "case name": "gives-a-value-its-type", owes: '"written-out-answers"' };

type RecordSamples = { readonly [Kind in HoneRecord["kind"]]: readonly Filled<Extract<HoneRecord, { readonly kind: Kind }>>[] };

const NOTED_LOCATIONS: { readonly [Kind in CatalogueNote["kind"]]: Filled<AuthorisedLocation> } = {
  "unknown-check": { entry: { ...MATCHED_LOCATION, reach: UNKNOWN_CHECK_REACH }, fills: UNKNOWN_CHECK_FILLS },
  "unknown-case": { entry: UNKNOWN_CASE_LOCATION, fills: { ...WEBHOOK_FILLS, ...UNKNOWN_CASE_WORDS } },
  "owes-not-owed": { entry: UNOWED_LOCATION, fills: { ...WEBHOOK_FILLS, ...UNOWED_WORDS } },
};

const RECORD_SAMPLES: RecordSamples = {
  debt: [
    { entry: STATED_DEBT, fills: WEBHOOK_FILLS },
    { entry: CARRIED_DEBT, fills: WEBHOOK_FILLS },
    { entry: { ...STATED_DEBT, reach: CAST_REACH }, fills: CAST_FILLS },
    { entry: { ...CARRIED_DEBT, reach: CAST_REACH }, fills: CAST_FILLS },
  ],
  "authorised-location": [
    { entry: MATCHED_LOCATION, fills: WEBHOOK_FILLS },
    { entry: CARRIED_LOCATION, fills: WEBHOOK_FILLS },
    { entry: { ...MATCHED_LOCATION, reach: CAST_REACH }, fills: CAST_FILLS },
    { entry: { ...CARRIED_LOCATION, reach: CAST_REACH }, fills: CAST_FILLS },
    { entry: { ...CARRIED_LOCATION, reach: UNKNOWN_CHECK_REACH }, fills: UNKNOWN_CHECK_FILLS },
    ...Object.values(NOTED_LOCATIONS),
    { entry: { ...UNKNOWN_CASE_LOCATION, reach: CAST_REACH }, fills: { ...CAST_FILLS, ...UNKNOWN_CASE_WORDS } },
    { entry: { ...UNOWED_LOCATION, reach: CAST_REACH }, fills: { ...CAST_FILLS, ...UNOWED_WORDS } },
    { entry: { ...UNKNOWN_CASE_LOCATION, reach: UNKNOWN_CHECK_REACH }, fills: { ...UNKNOWN_CHECK_FILLS, ...UNKNOWN_CASE_WORDS } },
    { entry: { ...UNOWED_LOCATION, reach: UNKNOWN_CHECK_REACH }, fills: { ...UNKNOWN_CHECK_FILLS, ...UNOWED_WORDS } },
  ],
  deviation: [{ entry: DEVIATION, fills: { recipe: "world-values-through-a-port", file: "src/adapters/stripe-webhook.ts" } }],
  "boundary-record": [
    { entry: CLOCK_BOUNDARY, fills: { "outside party": "runtime:clock", module: "src/adapters/system-clock.ts" } },
    { entry: FILES_BOUNDARY, fills: { "outside party": "node:fs", module: "src/adapters/files" } },
  ],
  "dependency-record": [{ entry: DEPENDENCY, fills: { dependency: "zod" } }],
};

const RECORDS: readonly Filled<HoneRecord>[] = Object.values(RECORD_SAMPLES).flat();

const RECORD_PART_LINES: readonly PrintedLine[] = RECORDS.flatMap(({ entry, fills }) => [
  { label: "subject", text: recordSubjectText({ record: entry }), fills },
  { label: "reference", text: recordReferenceText({ record: entry }), fills },
]);

const DEBT_PLACED: PlacedRecord = { place: { file: DEBT_FILE, index: 0 }, record: STATED_DEBT };

const LOCATION_PLACED: PlacedRecord = { place: { file: AUTHORISED_FILE, index: 0 }, record: UNOWED_LOCATION };

const LOCATION_SUBJECT = 'claimed-type authorised-location src/adapters/stripe-webhook.ts note: gives-a-value-its-type does not owe "written-out-answers"';

const DEBT_SUBJECT = "claimed-type debt src/adapters/stripe-webhook.ts";

const UNOWED_REFERENCE = 'authorised-location note: gives-a-value-its-type does not owe "written-out-answers"';

const CLOCK_FILLS: Fills = {
  check: "date-used-directly#clock-sources",
  engine: "walker",
  file: "src/orders/charge-order.ts",
  line: "14",
  column: "0",
  snippet: "const chargedAt = clock.now();",
  indicated: "ports-declared-inside, written-out-answers, doer-or-orchestrator",
};

const REMEDY = { fix: "write one test per case, or one it.each table", page: CHECKS_PAGE, section: "branching-with-if" };

const REMEDY_FILLS: Fills = { fix: "write one test per case, or one it.each table", "fix page": CHECKS_PAGE, section: "branching-with-if" };

const TEAM_FILLS: Fills = { check: "acme/AC-1#no-moment", engine: "eslint", file: "src/orders/charge-order.ts", line: "3", column: "6", snippet: "moment()" };

const CAST_SITE_FILLS: Fills = { check: "claimed-type#cast-expressions", engine: "eslint" };

const WEBHOOK_SITE_FILLS: Fills = { ...CAST_SITE_FILLS, file: "src/adapters/stripe-webhook.ts" };

const SCRIPT_FILLS: Fills = { ...CAST_SITE_FILLS, "package file": "package.json", script: "lint" };

type RefusedSample<Kind extends RecordRefusal["kind"]> = Filled<{ readonly place: RecordPlace; readonly refusals: readonly [Extract<RecordRefusal, { readonly kind: Kind }>] }>;

const REFUSALS: { readonly [Kind in RecordRefusal["kind"]]: RefusedSample<Kind> } = {
  "form-refused": {
    entry: {
      place: { file: AUTHORISED_FILE, index: 2 },
      refusals: [{ kind: "form-refused", issues: [{ code: "invalid_type", expected: "string", path: ["file"], message: "Invalid input: expected string, received number", input: 3 }] }],
    },
    fills: { "records file": "hone-records/authorised-locations/claimed-type.json", index: "2", issues: "file: Invalid input: expected string, received number" },
  },
  "unknown-symptom": {
    entry: { place: { file: DEBT_FILE, index: 1 }, refusals: [{ kind: "unknown-symptom", symptom: "claimed type" }] },
    fills: { "records file": "hone-records/debt/claimed-type.json", index: "1", given: '"claimed type"' },
  },
  "unknown-check": {
    entry: { place: { file: DEBT_FILE, index: 5 }, refusals: [{ kind: "unknown-check", symptom: "claimed-type", check: "cast-old" }] },
    fills: { "records file": "hone-records/debt/claimed-type.json", index: "5", given: '"cast-old"', symptom: "claimed-type" },
  },
  "unknown-recipe": {
    entry: { place: { file: DEVIATIONS_FILE, index: 0 }, refusals: [{ kind: "unknown-recipe", recipe: "stub-with-vi-fn" }] },
    fills: { "records file": "hone-records/deviations/world-values-through-a-port.json", index: "0", given: '"stub-with-vi-fn"' },
  },
  "recipe-reason-not-the-catalogues": {
    entry: { place: { file: DEVIATIONS_FILE, index: 1 }, refusals: [{ kind: "recipe-reason-not-the-catalogues", recipe: WORLD_VALUES_THROUGH_A_PORT, recipeReason: "ports" }] },
    fills: { "records file": "hone-records/deviations/world-values-through-a-port.json", index: "1", recipe: "world-values-through-a-port", reason: '"the world reaches a unit through a port"' },
  },
  "named-ban": {
    entry: { place: { file: DEPENDENCIES_FILE, index: 0 }, refusals: [{ kind: "named-ban", dependency: "lodash" }] },
    fills: { "records file": "hone-records/dependency-records.json", index: "0", dependency: "lodash" },
  },
  "unknown-runtime-facility": {
    entry: { place: { file: BOUNDARIES_FILE, index: 3 }, refusals: [{ kind: "unknown-runtime-facility", outsideParty: "runtime:env" }] },
    fills: { "records file": "hone-records/boundary-records.json", index: "3", "outside party": "runtime:env" },
  },
  misplaced: {
    entry: { place: { file: DEBT_FILE, index: 2 }, refusals: [{ kind: "misplaced", belongsIn: repoPathSchema.parse("hone-records/debt/date-used-directly.json") }] },
    fills: { "records file": "hone-records/debt/claimed-type.json", index: "2", "belongs in": "hone-records/debt/date-used-directly.json" },
  },
  "not-a-records-name": {
    entry: { place: { file: DEBT_FILE, index: 3 }, refusals: [{ kind: "not-a-records-name", name: "../x" }] },
    fills: { "records file": "hone-records/debt/claimed-type.json", index: "3", given: '"../x"' },
  },
  "carried-changed-since-base": {
    entry: { place: { file: AUTHORISED_FILE, index: 4 }, refusals: [{ kind: "carried-changed-since-base" }] },
    fills: { "records file": "hone-records/authorised-locations/claimed-type.json", index: "4" },
  },
  duplicate: {
    entry: { place: { file: AUTHORISED_FILE, index: 5 }, refusals: [{ kind: "duplicate", of: { file: AUTHORISED_FILE, index: 0 } }] },
    fills: { "records file": "hone-records/authorised-locations/claimed-type.json", index: "5", "earlier index": "0" },
  },
};

type SimpleNativeKind = Exclude<AttributedNativeException["kind"], "inline-disable" | "command-line-option">;

const SIMPLE_NATIVES: { readonly [Kind in SimpleNativeKind]: Filled<Extract<AttributedNativeException, { readonly kind: Kind }>> } = {
  ignore: { entry: { kind: "ignore", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, mechanism: ESLINT }, fills: WEBHOOK_SITE_FILLS },
  "config-override": { entry: { kind: "config-override", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, mechanism: ESLINT }, fills: WEBHOOK_SITE_FILLS },
  "suppression-entry": {
    entry: { kind: "suppression-entry", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, location: repoPathSchema.parse("eslint-suppressions.json"), mechanism: ESLINT },
    fills: { ...WEBHOOK_SITE_FILLS, "suppressions file": "eslint-suppressions.json" },
  },
  "inline-rule-config": {
    entry: { kind: "inline-rule-config", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, line: 1, text: "/* eslint no-restricted-syntax: off */", mechanism: ESLINT },
    fills: { ...WEBHOOK_SITE_FILLS, line: "1", comment: "/* eslint no-restricted-syntax: off */" },
  },
};

const INLINE_DISABLES: Readonly<Record<InlineReach, Filled<AttributedNativeException>>> = {
  "one-clause": {
    entry: { kind: "inline-disable", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, line: 4, text: "// eslint-disable-next-line no-restricted-syntax", reach: "one-clause", mechanism: ESLINT },
    fills: { ...WEBHOOK_SITE_FILLS, line: "4", comment: "// eslint-disable-next-line no-restricted-syntax" },
  },
  "every-selected-clause": {
    entry: { kind: "inline-disable", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, line: 4, text: "// eslint-disable-next-line", reach: "every-selected-clause", mechanism: ESLINT },
    fills: { ...WEBHOOK_SITE_FILLS, line: "4", comment: "// eslint-disable-next-line" },
  },
};

const MISNAMED_RULE_IDS: readonly Filled<MisnamedRuleId>[] = [
  {
    entry: {
      kind: "version-1-id",
      ruleId: "hone/no-class-authoring",
      file: WEBHOOK_FILE,
      line: 3,
      text: "// eslint-disable-next-line hone/no-class-authoring",
      replacedBy: ["hone/authored-class-or-this#class-keyword"],
    },
    fills: {
      ...WEBHOOK_FILLS,
      line: "3",
      "rule id": "hone/no-class-authoring",
      "version 2 rule id": "hone/authored-class-or-this#class-keyword",
      comment: "// eslint-disable-next-line hone/no-class-authoring",
    },
  },
  {
    entry: {
      kind: "version-1-id",
      ruleId: "hone/no-class-authoring",
      file: WEBHOOK_FILE,
      line: 4,
      text: "// eslint-disable-next-line hone/no-class-authoring",
      replacedBy: ["hone/a#first", "hone/a#second"],
    },
    fills: {
      ...WEBHOOK_FILLS,
      line: "4",
      "rule id": "hone/no-class-authoring",
      "version 2 rule ids": "hone/a#first, hone/a#second",
      comment: "// eslint-disable-next-line hone/no-class-authoring",
    },
  },
  {
    entry: { kind: "names-no-check", ruleId: "hone/claimed-type#no-such-check", file: WEBHOOK_FILE, line: 6, text: "/* eslint-disable hone/claimed-type#no-such-check */" },
    fills: { ...WEBHOOK_FILLS, line: "6", "rule id": "hone/claimed-type#no-such-check", comment: "/* eslint-disable hone/claimed-type#no-such-check */" },
  },
];

const SCRIPT_OPTIONS: Readonly<Record<ScriptOptionCause["kind"], Filled<AttributedNativeException>>> = {
  "weakens-run": {
    entry: { kind: "command-line-option", clause: CAST_EXPRESSIONS, location: PACKAGE_FILE, script: "lint", option: "--no-inline-config", cause: { kind: "weakens-run" }, mechanism: ESLINT },
    fills: { ...SCRIPT_FILLS, option: "--no-inline-config" },
  },
  "after-another-command": {
    entry: {
      kind: "command-line-option",
      clause: CAST_EXPRESSIONS,
      location: PACKAGE_FILE,
      script: "lint",
      option: "--rule x:off",
      cause: { kind: "after-another-command", command: "eslint", invocation: "eslint --rule x:off ." },
      mechanism: ESLINT,
    },
    fills: { ...SCRIPT_FILLS, option: "--rule x:off", command: "eslint", invocation: '"eslint --rule x:off ."' },
  },
  wrapped: {
    entry: { kind: "command-line-option", clause: CAST_EXPRESSIONS, location: PACKAGE_FILE, script: "lint", option: "--rule x:off", cause: { kind: "wrapped", command: "eslint", wrapper: "env" }, mechanism: ESLINT },
    fills: { ...SCRIPT_FILLS, option: "--rule x:off", command: "eslint", wrapper: '"env"' },
  },
  unreadable: {
    entry: { kind: "command-line-option", clause: CAST_EXPRESSIONS, location: PACKAGE_FILE, script: "lint", option: "eslint 'x", cause: { kind: "unreadable", command: "eslint" }, mechanism: ESLINT },
    fills: { ...SCRIPT_FILLS, option: "eslint 'x", command: "eslint" },
  },
};

const GIT_FAILED: BaseRevisionAvailability = { state: "git-failed", revision: "origin/main", gitMessage: "fatal: bad revision" };

const GIT_FAILED_FILLS: Fills = { revision: '"origin/main"', "git message": '"fatal: bad revision"' };

const BASE_STATES: Readonly<Record<BaseRevisionAvailability["state"], Filled<BaseRevisionAvailability>>> = {
  "not-given": { entry: { state: "not-given" }, fills: {} },
  "git-failed": { entry: GIT_FAILED, fills: GIT_FAILED_FILLS },
};

const RECORDS_UNMEASURED_KINDS: Readonly<Record<RecordsUnmeasured["kind"], RecordsUnmeasured["kind"]>> = {
  "forfeiture-unmeasured": "forfeiture-unmeasured",
  "import-unmeasured": "import-unmeasured",
};

const RECORDS_UNMEASURED: readonly Filled<RunUnmeasured>[] = Object.values(RECORDS_UNMEASURED_KINDS).flatMap((kind) =>
  Object.values(BASE_STATES).map((base) => ({ entry: { kind, base: base.entry }, fills: base.fills })),
);

const ENGINES_NOT_RUN: Readonly<Record<EngineNotRun["projection"], readonly Filled<RunUnmeasured>[]>> = {
  missing: [{ entry: { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "missing" }, fills: { engine: "eslint" } }],
  "measured-nothing": [{ entry: { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "measured-nothing" }, fills: { engine: "eslint" } }],
  "not-included": [
    { entry: { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "not-included", nestedConfigurations: [] }, fills: { engine: "eslint" } },
    {
      entry: { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "not-included", nestedConfigurations: [repoPathSchema.parse("packages/legacy")] },
      fills: { engine: "eslint", folders: "packages/legacy" },
    },
  ],
};

type SliceState = Extract<RunProjectionProblem, { readonly scope: "slice" }>["state"];

const sliceProblem = (request: { readonly state: SliceState }): Filled<RunProjectionProblem> => ({
  entry: { scope: "slice", engine: ESLINT_ENGINE, state: request.state, slice: SLICE },
  fills: { engine: "eslint", slice: "packages/web/hone.eslint.mjs", folder: "packages/web" },
});

const DECLARATION_SLICE_PROBLEM: Filled<RunProjectionProblem> = {
  entry: { scope: "slice", engine: ESLINT_ENGINE, state: "missing", slice: repoPathSchema.parse("packages/web/hone.eslint.d.mts") },
  fills: { engine: "eslint", slice: "packages/web/hone.eslint.d.mts", folder: "packages/web" },
};

const SLICE_PROBLEMS: Readonly<Record<SliceState, Filled<RunProjectionProblem>>> = {
  "out-of-date": sliceProblem({ state: "out-of-date" }),
  missing: sliceProblem({ state: "missing" }),
  unconfigured: sliceProblem({ state: "unconfigured" }),
};

const SPACED_RECORDS_FILE: Filled<RunReport["refused"][number]> = {
  entry: { place: { file: repoPathSchema.parse("hone-records/debt/claimed type.json"), index: 0 }, refusals: [{ kind: "misplaced", belongsIn: DEBT_FILE }] },
  fills: { "records file": '"hone-records/debt/claimed type.json"', index: "0", "belongs in": "hone-records/debt/claimed-type.json" },
};

const RECORD_NOTES: { readonly [Kind in CatalogueNote["kind"]]: Filled<RecordNote> } = {
  "unknown-check": {
    entry: { place: { file: AUTHORISED_FILE, index: 7 }, note: { kind: "unknown-check", symptom: CLAIMED_TYPE, check: "cast-old" } },
    fills: { "records file": "hone-records/authorised-locations/claimed-type.json", index: "7", given: '"cast-old"', symptom: "claimed-type" },
  },
  "unknown-case": {
    entry: { place: { file: AUTHORISED_FILE, index: 8 }, note: { kind: "unknown-case", case: "parses a webhook", owes: "declared-not-asserted" } },
    fills: { "records file": "hone-records/authorised-locations/claimed-type.json", index: "8", case: '"parses a webhook"', owes: '"declared-not-asserted"' },
  },
  "owes-not-owed": {
    entry: { place: { file: AUTHORISED_FILE, index: 0 }, note: { kind: "owes-not-owed", case: GIVES_A_VALUE_ITS_TYPE, owes: "written-out-answers" } },
    fills: { "records file": "hone-records/authorised-locations/claimed-type.json", index: "0", "case name": "gives-a-value-its-type", owes: '"written-out-answers"' },
  },
};

const CONVENTION_NOTES: Readonly<Record<ConventionKey, Filled<RunReport["settings-notes"][number]>>> = {
  generated: { entry: { kind: "declared-not-read", key: "generated" }, fills: { convention: "generated" } },
  layers: { entry: { kind: "declared-not-read", key: "layers" }, fills: { convention: "layers" } },
};

const SECTION_SAMPLES: SectionSamples = {
  excluded: [{ entry: repoPathSchema.parse("dist"), fills: { path: "dist" } }],
  "not-adopted": [{ entry: CAST_CHECK, fills: CAST_SITE_FILLS }],
  "not-run": [{ entry: TEST_BODY_CHECK, fills: { check: "branch-in-a-test#test-body" } }],
  editions: [{ entry: { check: CLOCK_CHECK, engine: WALKER, edition: editionSchema.parse("1"), latest: editionSchema.parse("2") }, fills: { ...CLOCK_FILLS, edition: "1", latest: "2" } }],
  findings: [
    { entry: { clause: CLOCK_SOURCES, mechanism: AUDIT, file: ORDER_FILE, anchor: { line: 14, column: 0 }, snippet: "const chargedAt = clock.now();" }, fills: CLOCK_FILLS },
    {
      entry: { clause: TEST_BODY_LOGIC, mechanism: AUDIT, file: TEST_FILE, anchor: { line: 22, column: 2 }, snippet: "if (result.ok) {", remedy: REMEDY },
      fills: {
        ...REMEDY_FILLS,
        check: "branch-in-a-test#test-body",
        engine: "walker",
        file: "src/orders/charge-order.test.ts",
        line: "22",
        column: "2",
        snippet: "if (result.ok) {",
        indicated: "straight-through-tests, no-hidden-effects",
      },
    },
    { entry: { clause: TEAM_CLAUSE, mechanism: ESLINT, file: ORDER_FILE, anchor: { line: 3, column: 6 }, snippet: "moment()" }, fills: TEAM_FILLS },
    { entry: { clause: TEAM_CLAUSE, mechanism: ESLINT, file: ORDER_FILE, anchor: { line: 3, column: 6 }, snippet: "moment()", remedy: REMEDY }, fills: { ...TEAM_FILLS, ...REMEDY_FILLS } },
  ],
  answered: [
    {
      entry: { finding: { clause: CAST_EXPRESSIONS, mechanism: ESLINT, file: WEBHOOK_FILE, anchor: { line: 4, column: 9 }, snippet: "body as Event" }, by: [LOCATION_PLACED] },
      fills: { ...WEBHOOK_SITE_FILLS, line: "4", column: "9", snippet: "body as Event", reference: UNOWED_REFERENCE },
    },
  ],
  uncovered: [{ entry: CLOCK_CHECK, fills: CLOCK_FILLS }],
  stale: [
    { entry: { placed: LOCATION_PLACED, reason: "credited-nothing" }, fills: { subject: LOCATION_SUBJECT } },
    { entry: { placed: LOCATION_PLACED, reason: "file-gone" }, fills: { subject: LOCATION_SUBJECT } },
    { entry: { placed: LOCATION_PLACED, reason: "file-excluded" }, fills: { subject: LOCATION_SUBJECT } },
    { entry: { placed: DEBT_PLACED, reason: "credited-nothing" }, fills: { subject: DEBT_SUBJECT } },
    { entry: { placed: DEBT_PLACED, reason: "file-gone" }, fills: { subject: DEBT_SUBJECT } },
    { entry: { placed: DEBT_PLACED, reason: "file-excluded" }, fills: { subject: DEBT_SUBJECT } },
  ],
  forfeited: [{ entry: DEBT_PLACED, fills: { subject: DEBT_SUBJECT } }],
  unrecorded: [...Object.values(SIMPLE_NATIVES), ...Object.values(INLINE_DISABLES), ...Object.values(SCRIPT_OPTIONS)],
  misnamed: MISNAMED_RULE_IDS,
  paid: [{ entry: { debt: DEBT_PLACED, answeredBy: [LOCATION_PLACED] }, fills: { subject: DEBT_SUBJECT, reference: UNOWED_REFERENCE } }],
  refused: [...Object.values(REFUSALS), SPACED_RECORDS_FILE],
  unmeasured: [...RECORDS_UNMEASURED, ...Object.values(ENGINES_NOT_RUN).flat()],
  "projection-problems": [{ entry: { scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" }, fills: { engine: "eslint" } }, ...Object.values(SLICE_PROBLEMS), DECLARATION_SLICE_PROBLEM],
  assessment: [
    { entry: { concern: "forfeiture", assessedBy: "elsewhere", debts: 1 }, fills: {} },
    { entry: { concern: "forfeiture", assessedBy: "elsewhere", debts: 3 }, fills: { count: "3" } },
    { entry: { concern: "carried-standing", assessedBy: "elsewhere", carried: 1 }, fills: {} },
    { entry: { concern: "carried-standing", assessedBy: "elsewhere", carried: 3 }, fills: { count: "3" } },
  ],
  "settings-notes": Object.values(CONVENTION_NOTES),
  "record-notes": Object.values(RECORD_NOTES),
  carried: [
    {
      entry: { place: { file: AUTHORISED_FILE, index: 6 }, lacks: ["case", "owes", "whyChain"], standing: "unjudged" },
      fills: { "records file": "hone-records/authorised-locations/claimed-type.json", index: "6", standing: "unjudged", lacks: "case, owes, whyChain" },
    },
    { entry: { place: { file: DEBT_FILE, index: 4 }, lacks: [], standing: "established" }, fills: { "records file": "hone-records/debt/claimed-type.json", index: "4", standing: "established" } },
  ],
  symptoms: [
    {
      entry: DATE_USED_DIRECTLY,
      fills: {
        symptom: "date-used-directly",
        title: "Date used directly",
        indications: "needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator",
        breach: "in the unit that should be passed the time, often a doer doing two jobs",
        "recipe title": "World values through a port",
        answers: "Correct use: a boundary record on the clock adapter. Known debt: debt",
      },
    },
    {
      entry: BRANCH_IN_A_TEST,
      fills: {
        symptom: "branch-in-a-test",
        title: "Branch in a test",
        indications: "checks a value that may be one of several outcomes → Straight-through tests, No hidden effects",
        breach: "in the unit's output type, where optional or loose shapes force the test to branch",
        "recipe titles": "Assert to narrow; it.each over typed rows",
        answers: "Known debt: debt",
      },
    },
    {
      entry: CLAIMED_TYPE,
      fills: {
        symptom: "claimed-type",
        title: "Claimed type",
        indications: "gives a value its type: or needs it narrower → Declared, not asserted",
        breach: "at the producer",
        answers: "A schema proves the type: an authorised location. Known debt: debt",
      },
    },
  ],
};

const entriesOf = <Entry>(samples: readonly Filled<Entry>[]): readonly Entry[] => samples.map((sample) => sample.entry);

const EMPTY_REPORT: RunReport = {
  excluded: [],
  "not-adopted": [],
  "not-run": [],
  editions: [],
  findings: [],
  answered: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  misnamed: [],
  paid: [],
  refused: [],
  unmeasured: [],
  "projection-problems": [],
  assessment: [],
  "settings-notes": [],
  "record-notes": [],
  carried: [],
  symptoms: [],
};

const EVERY_ENTRY: RunReport = {
  excluded: entriesOf(SECTION_SAMPLES.excluded),
  "not-adopted": entriesOf(SECTION_SAMPLES["not-adopted"]),
  "not-run": entriesOf(SECTION_SAMPLES["not-run"]),
  editions: entriesOf(SECTION_SAMPLES.editions),
  findings: entriesOf(SECTION_SAMPLES.findings),
  answered: entriesOf(SECTION_SAMPLES.answered),
  uncovered: entriesOf(SECTION_SAMPLES.uncovered),
  stale: entriesOf(SECTION_SAMPLES.stale),
  forfeited: entriesOf(SECTION_SAMPLES.forfeited),
  unrecorded: entriesOf(SECTION_SAMPLES.unrecorded),
  misnamed: entriesOf(SECTION_SAMPLES.misnamed),
  paid: entriesOf(SECTION_SAMPLES.paid),
  refused: entriesOf(SECTION_SAMPLES.refused),
  unmeasured: entriesOf(SECTION_SAMPLES.unmeasured),
  "projection-problems": entriesOf(SECTION_SAMPLES["projection-problems"]),
  assessment: entriesOf(SECTION_SAMPLES.assessment),
  "settings-notes": entriesOf(SECTION_SAMPLES["settings-notes"]),
  "record-notes": entriesOf(SECTION_SAMPLES["record-notes"]),
  carried: entriesOf(SECTION_SAMPLES.carried),
  symptoms: entriesOf(SECTION_SAMPLES.symptoms),
};

const sampleFills: EntryFills<RunSectionName> = ({ section, position }) => ({ ...SHARED_FILLS, ...SECTION_SAMPLES[section][position]?.fills });

const linesOfReport = (request: { readonly report: RunReport; readonly output: VersionTwoReportOutput }): readonly PrintedLine[] =>
  sectionedLinesOf({
    text: renderRunReportText({ report: request.report, output: request.output, catalogue: REPORT_CATALOGUE, symptomPage: SYMPTOM_PAGE, projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND }),
    sections: RUN_SECTION_NAMES,
    first: "excluded",
    entryFills: sampleFills,
  });

const UNSLICED_REPORT: RunReport = { ...EMPTY_REPORT, unmeasured: EVERY_ENTRY.unmeasured };

const VERDICT_REPORTS: readonly RunReport[] = [
  EMPTY_REPORT,
  { ...EMPTY_REPORT, findings: EVERY_ENTRY.findings },
  { ...EMPTY_REPORT, assessment: EVERY_ENTRY.assessment },
  { ...EMPTY_REPORT, findings: EVERY_ENTRY.findings, assessment: EVERY_ENTRY.assessment },
];

export const RUN_PRINTABLE_LINES: readonly PrintedLine[] = [
  ...versionTwoReportOutputSchema.options.flatMap((output) => linesOfReport({ report: EVERY_ENTRY, output })),
  ...linesOfReport({ report: UNSLICED_REPORT, output: "full" }),
  ...VERDICT_REPORTS.flatMap((report) => linesOfReport({ report, output: "verdict-only" })),
  ...RECORD_PART_LINES,
];

export const RUN_SECTION_ROLES: readonly DocumentedRole[] = RUN_SECTION_NAMES.map((section) => ({ section, role: runSectionRoleOf({ section }) }));
