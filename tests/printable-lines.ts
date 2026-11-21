import { type ArgumentProblem, argumentsInvalid } from "../src/infrastructure/command-line/arguments/argument-problem.ts";
import { helpText, SYNOPSIS } from "../src/infrastructure/command-line/arguments/command-help.ts";
import { FORFEITURE_OPTION, type HelpTopic, LEAVE_OPTION, REPO_OPTION, SUBCOMMANDS } from "../src/infrastructure/command-line/arguments/command-line.ts";
import { projectCommandOutcome, versionCommandOutcome } from "../src/infrastructure/command-line/outcomes/command-outcome.ts";
import {
  pruneDebtCommandOutcome,
  recordDebtCommandOutcome,
  splitRecordsCommandOutcome,
} from "../src/infrastructure/command-line/outcomes/record-command-outcomes.ts";
import { installedVersionOf } from "../src/infrastructure/command-line/installation/installed-version.ts";
import type { LoadFailure } from "../src/infrastructure/command-line/load-failure.ts";
import { loadFailureText } from "../src/infrastructure/printed-report/load-failures/load-failure-text.ts";
import type { ExceptionRecord } from "../src/domain/records/discipline-exceptions/exception-record.ts";
import type { InheritedDebtOutcome } from "../src/domain/records/discipline-exceptions/inherited-debt.ts";
import type {
  ExistingAuthorisationProvenance,
  InheritedDebtProvenance,
  InvalidRecord,
  RecordsSplit,
} from "../src/infrastructure/discipline-exceptions-folder/exception-records.ts";
import type { AttributedNativeException, Finding } from "../src/infrastructure/command-line/governance.ts";
import type { RunnerFailure } from "../src/application/ports/runner-failure.ts";
import type { ProjectionWrite } from "../src/infrastructure/engines/protocol/runner-module/runner-result-schema.ts";
import type { FilePresence, FileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import { createPathPort } from "../src/infrastructure/node/path-port.ts";
import { WAIVED_CLAUSES_REPLACEMENT } from "../src/infrastructure/hone-config-file/assessment.ts";
import type { BaseRevisionAvailability } from "../src/domain/repository/base-revision-availability.ts";
import { clauseAddressSchema } from "../src/infrastructure/discipline-exceptions-folder/clause-address.ts";
import { type ClauseEditionReading, editionSchema } from "../src/infrastructure/content-files/edition.ts";
import { mechanismIdSchema } from "../src/infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../src/infrastructure/hone-records-folder/repo-path.ts";
import { type ReportOutput, reportOutputSchema } from "../src/infrastructure/hone-config-file/report-output.ts";
import type {
  AssessmentFileNote,
  AssessmentSection,
  CheckReport,
  ClauseReading,
  PaidDebtNote,
  PartialAssessment,
  ProjectionProblem,
  Unmeasured,
} from "../src/domain/report/check-report.ts";
import { SECTION_NAMES, type SectionName, sectionRoleOf } from "../src/domain/report/section-roles.ts";
import { NO_SYMPTOM_GUIDE, type SymptomGuide, type UnreadableGuide } from "../src/infrastructure/printed-report/symptoms/symptom-notes.ts";
import type { Case, Principle, Recipe, RecordKind, Rule, Symptom } from "../src/domain/language-layer/symptom-catalogue.ts";
import type { Verdict } from "../src/domain/report/verdict.ts";
import { VERSION_ONE_CAUSAL_WHY_CHAIN } from "./version-one-causal-why-chain.ts";
import { type DocumentedRole, type EntryFills, type Fills, type PrintedLine, reportLinesOf } from "./output-contract.ts";
import { UPGRADE_LINES } from "./printable-upgrade-lines.ts";

type EveryKind<Union extends { readonly kind: string }> = {
  readonly [Kind in Union["kind"]]: Extract<Union, { readonly kind: Kind }>;
};

type Filled<Entry> = {
  readonly entry: Entry;
  readonly fills: Fills;
};

type SectionSamples = {
  readonly [Name in SectionName]: readonly Filled<CheckReport[Name][number]>[];
};

const LOOPS = clauseAddressSchema.parse("CD-15#loops");
const MECHANISM = mechanismIdSchema.parse("eslint");
const FILE = repoPathSchema.parse("src/basket.ts");
const RULE_PAGE = "node_modules/@hailstails/hone/rules/CD-15/README.md";
const ADOPTION_GUIDE = "node_modules/@hailstails/hone/ADOPTING.md";

const PROJECT_COMMAND = "node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop";

const PRUNE_COMMAND = "node /work/shop/node_modules/@hailstails/hone/src/hone.js prune-debt --repo /work/shop --base-revision origin/main";

const SHARED_FILLS: Fills = {
  clause: "CD-15#loops",
  mechanism: "eslint",
  file: "src/basket.ts",
  line: "15",
  column: "0",
  snippet: "const total = 0;\\nreturn total;",
  "rule page": RULE_PAGE,
  "adoption guide": ADOPTION_GUIDE,
  "project command": PROJECT_COMMAND,
  "prune command": PRUNE_COMMAND,
};

const EDITION_READING: ClauseEditionReading = {
  address: LOOPS,
  mechanism: MECHANISM,
  edition: editionSchema.parse("1"),
  latest: editionSchema.parse("2"),
};

const FINDING: Finding = { clause: LOOPS, mechanism: MECHANISM, file: FILE, anchor: { line: 15, column: 0 }, snippet: "const total = 0;\nreturn total;" };

const REMEDIED_FINDING: Filled<Finding> = {
  entry: { ...FINDING, remedy: { fix: "write the values out", page: "node_modules/@hailstails/hone/rules/CD-27/CHECKS.md", section: "a-method-that-computes-a-value" } },
  fills: { fix: "write the values out", "fix page": "node_modules/@hailstails/hone/rules/CD-27/CHECKS.md", section: "a-method-that-computes-a-value" },
};

const RECORDS: EveryKind<ExceptionRecord> = {
  "authorised-location": { kind: "authorised-location", clause: LOOPS, mechanism: MECHANISM, file: FILE, reason: "the adapter" },
  "file-carve-out": { kind: "file-carve-out", clause: LOOPS, mechanism: MECHANISM, file: FILE, reason: "debt", whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN },
  "clause-wide-carve-out": { kind: "clause-wide-carve-out", clause: LOOPS, mechanism: MECHANISM, reason: "debt", whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN },
};

const IMPORTED_RECORDS: Readonly<Record<(ExistingAuthorisationProvenance | InheritedDebtProvenance)["kind"], Filled<ExceptionRecord>>> = {
  "existing-authorisation": {
    entry: {
      kind: "authorised-location",
      clause: LOOPS,
      mechanism: MECHANISM,
      file: FILE,
      reason: "the adapter",
      provenance: { kind: "existing-authorisation", source: "legacy/authorisations.json#2" },
    },
    fills: { "record kind": "authorised-location", source: "legacy/authorisations.json#2" },
  },
  "inherited-debt": {
    entry: {
      kind: "file-carve-out",
      clause: LOOPS,
      mechanism: MECHANISM,
      file: FILE,
      reason: "debt",
      provenance: { kind: "inherited-debt", source: "legacy/exceptions.json#3", decision: "kept" },
    },
    fills: { "record kind": "file-carve-out", source: "legacy/exceptions.json#3" },
  },
};

type AttributedInlineDisable = Extract<AttributedNativeException, { readonly kind: "inline-disable" }>;

type AttributedScriptOption = Extract<AttributedNativeException, { readonly kind: "command-line-option" }>;

const INLINE_DISABLES: Readonly<Record<AttributedInlineDisable["reach"], Filled<AttributedInlineDisable>>> = {
  "one-clause": {
    entry: { kind: "inline-disable", clause: LOOPS, mechanism: MECHANISM, file: FILE, line: 4, text: "// eslint-disable-next-line", reach: "one-clause" },
    fills: { line: "4", comment: "// eslint-disable-next-line" },
  },
  "every-selected-clause": {
    entry: { kind: "inline-disable", clause: LOOPS, mechanism: MECHANISM, file: FILE, line: 1, text: "/* eslint-disable */", reach: "every-selected-clause" },
    fills: { line: "1", comment: "/* eslint-disable */" },
  },
};

const SCRIPT_OPTION_INVOCATION = "TIMING=1 eslint -c eslint.config.mjs .";

const SCRIPT_OPTION_WRAPPER = "env";

const SCRIPT_OPTIONS: Readonly<Record<AttributedScriptOption["cause"]["kind"], Filled<AttributedScriptOption>>> = {
  "weakens-run": {
    entry: {
      kind: "command-line-option",
      clause: LOOPS,
      mechanism: MECHANISM,
      location: repoPathSchema.parse("package.json"),
      script: "lint",
      option: "--no-inline-config",
      cause: { kind: "weakens-run" },
    },
    fills: { "package file": "package.json", script: "lint", option: "--no-inline-config" },
  },
  "after-another-command": {
    entry: {
      kind: "command-line-option",
      clause: LOOPS,
      mechanism: MECHANISM,
      location: repoPathSchema.parse("package.json"),
      script: "lint",
      option: "-c eslint.config.mjs",
      cause: { kind: "after-another-command", command: "eslint", invocation: SCRIPT_OPTION_INVOCATION },
    },
    fills: {
      "package file": "package.json",
      script: "lint",
      option: "-c eslint.config.mjs",
      command: "eslint",
      invocation: JSON.stringify(SCRIPT_OPTION_INVOCATION),
    },
  },
  wrapped: {
    entry: {
      kind: "command-line-option",
      clause: LOOPS,
      mechanism: MECHANISM,
      location: repoPathSchema.parse("package.json"),
      script: "lint",
      option: "--ignore-pattern legacy/**",
      cause: { kind: "wrapped", command: "eslint", wrapper: SCRIPT_OPTION_WRAPPER },
    },
    fills: {
      "package file": "package.json",
      script: "lint",
      option: "--ignore-pattern legacy/**",
      command: "eslint",
      wrapper: JSON.stringify(SCRIPT_OPTION_WRAPPER),
    },
  },
  unreadable: {
    entry: {
      kind: "command-line-option",
      clause: LOOPS,
      mechanism: MECHANISM,
      location: repoPathSchema.parse("package.json"),
      script: "lint",
      option: "eslint --ignore-pattern 'legacy/**",
      cause: { kind: "unreadable", command: "eslint" },
    },
    fills: { "package file": "package.json", script: "lint", option: "eslint --ignore-pattern 'legacy/**", command: "eslint" },
  },
};

const NATIVE_EXCEPTIONS: {
  readonly [Kind in AttributedNativeException["kind"]]: readonly Filled<Extract<AttributedNativeException, { readonly kind: Kind }>>[];
} = {
  ignore: [{ entry: { kind: "ignore", clause: LOOPS, mechanism: MECHANISM, file: FILE }, fills: {} }],
  "config-override": [{ entry: { kind: "config-override", clause: LOOPS, mechanism: MECHANISM, file: FILE }, fills: {} }],
  "suppression-entry": [
    {
      entry: { kind: "suppression-entry", clause: LOOPS, mechanism: MECHANISM, file: FILE, location: repoPathSchema.parse("eslint-suppressions.json") },
      fills: { "suppressions file": "eslint-suppressions.json" },
    },
  ],
  "inline-disable": Object.values(INLINE_DISABLES),
  "inline-rule-config": [
    {
      entry: { kind: "inline-rule-config", clause: LOOPS, mechanism: MECHANISM, file: FILE, line: 1, text: "/* eslint no-x: off */" },
      fills: { line: "1", comment: "/* eslint no-x: off */" },
    },
  ],
  "command-line-option": Object.values(SCRIPT_OPTIONS),
};

const SINGLE_RECORDS_FILE = repoPathSchema.parse("discipline-exceptions.json");

const SPLIT_RECORDS_FOLDER = repoPathSchema.parse("discipline-exceptions");

const SPLIT_RECORDS_FILE = repoPathSchema.parse("discipline-exceptions/file-carve-outs/cd-15.json");

const RECORD_PROBLEMS: { readonly [Kind in InvalidRecord["problem"]["kind"]]: Filled<Extract<InvalidRecord["problem"], { readonly kind: Kind }>> } = {
  "clause-unparseable": { entry: { kind: "clause-unparseable", detail: "not a clause address" }, fills: { detail: "not a clause address" } },
  "clause-not-selected": { entry: { kind: "clause-not-selected", clause: LOOPS }, fills: {} },
  "clause-not-adopted": { entry: { kind: "clause-not-adopted", clause: LOOPS }, fills: {} },
  "clause-not-run": { entry: { kind: "clause-not-run", clause: LOOPS }, fills: {} },
  "file-not-repo-path": { entry: { kind: "file-not-repo-path", file: "../outside.ts" }, fills: { file: "../outside.ts" } },
  "why-chain-refused": { entry: { kind: "why-chain-refused", detail: "the chain stops at a symptom" }, fills: { detail: "the chain stops at a symptom" } },
  "evidence-refused": { entry: { kind: "evidence-refused", detail: "no evidence" }, fills: { detail: "no evidence" } },
  "import-unverified": { entry: { kind: "import-unverified", detail: "the source has no such entry" }, fills: { detail: "the source has no such entry" } },
  "non-exemptible-clause": { entry: { kind: "non-exemptible-clause", clause: LOOPS }, fills: {} },
  duplicate: { entry: { kind: "duplicate", of: { layout: "single-file", file: SINGLE_RECORDS_FILE, index: 0 } }, fills: { "earlier index": "0" } },
};

const SPLIT_RECORD_PROBLEMS: typeof RECORD_PROBLEMS = {
  ...RECORD_PROBLEMS,
  duplicate: {
    entry: { kind: "duplicate", of: { layout: "split", file: SPLIT_RECORDS_FILE, index: 0 } },
    fills: { "earlier records file": SPLIT_RECORDS_FILE, "earlier index": "0" },
  },
};

type MechanismNotRun = Extract<Unmeasured, { readonly kind: "mechanism-not-run" }>;

type BaseDependentKind = Extract<Unmeasured, { readonly base: BaseRevisionAvailability }>["kind"];

const UNRUN_PROJECTIONS: Readonly<Record<MechanismNotRun["projection"], MechanismNotRun>> = {
  missing: { kind: "mechanism-not-run", mechanism: MECHANISM, projection: "missing" },
  "not-included": { kind: "mechanism-not-run", mechanism: MECHANISM, projection: "not-included", nestedConfigurations: [] },
};

const NESTED_UNRUN: Filled<Unmeasured> = {
  entry: {
    kind: "mechanism-not-run",
    mechanism: MECHANISM,
    projection: "not-included",
    nestedConfigurations: [repoPathSchema.parse("packages/legacy"), repoPathSchema.parse("packages/tools")],
  },
  fills: { folders: "packages/legacy, packages/tools" },
};

const GIT_FAILED_BASE = { state: "git-failed", revision: "origin/main", gitMessage: "fatal: bad revision" } as const;

const baseSamplesOf = (request: {
  readonly kind: BaseDependentKind;
}): Readonly<Record<BaseRevisionAvailability["state"], Filled<Unmeasured>>> => ({
  "not-given": { entry: { kind: request.kind, base: { state: "not-given" } }, fills: {} },
  "git-failed": {
    entry: { kind: request.kind, base: GIT_FAILED_BASE },
    fills: { revision: JSON.stringify(GIT_FAILED_BASE.revision), "git message": JSON.stringify(GIT_FAILED_BASE.gitMessage) },
  },
});

const UNMEASURED: Readonly<Record<Unmeasured["kind"], readonly Filled<Unmeasured>[]>> = {
  "forfeiture-unmeasured": Object.values(baseSamplesOf({ kind: "forfeiture-unmeasured" })),
  "import-unmeasured": Object.values(baseSamplesOf({ kind: "import-unmeasured" })),
  "legacy-chain-unmeasured": Object.values(baseSamplesOf({ kind: "legacy-chain-unmeasured" })),
  "mechanism-not-run": [...Object.values(UNRUN_PROJECTIONS).map((entry) => ({ entry, fills: {} })), NESTED_UNRUN],
};

const UNSLICED_UNRUN: readonly Filled<Unmeasured>[] = [{ entry: UNRUN_PROJECTIONS["not-included"], fills: {} }, NESTED_UNRUN];

const SLICE = repoPathSchema.parse("packages/web/disciplines.eslint.mjs");

const PROJECTION_PROBLEMS: {
  readonly [Scope in ProjectionProblem["scope"]]: Readonly<
    Record<Extract<ProjectionProblem, { readonly scope: Scope }>["state"], ProjectionProblem>
  >;
} = {
  projection: { "out-of-date": { scope: "projection", mechanism: MECHANISM, state: "out-of-date" } },
  slice: {
    "out-of-date": { scope: "slice", mechanism: MECHANISM, state: "out-of-date", slice: SLICE },
    missing: { scope: "slice", mechanism: MECHANISM, state: "missing", slice: SLICE },
    "not-applied": { scope: "slice", mechanism: MECHANISM, state: "not-applied", slice: SLICE },
    unconfigured: { scope: "slice", mechanism: MECHANISM, state: "unconfigured", slice: SLICE },
  },
};

const ONE_CARVE_OUT_ELSEWHERE: PartialAssessment = { concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: 1 };

const PARTIAL_ASSESSMENTS: {
  readonly [Concern in PartialAssessment["concern"]]: Readonly<Record<PartialAssessment["assessedBy"], readonly Filled<PartialAssessment>[]>>;
} = {
  forfeiture: {
    elsewhere: [
      { entry: ONE_CARVE_OUT_ELSEWHERE, fills: {} },
      { entry: { concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: 37 }, fills: { count: "37" } },
    ],
  },
};

const readingOf = (request: { readonly assessmentSection: AssessmentSection; readonly presence: FilePresence }): ClauseReading => ({
  kind: "clause",
  clause: LOOPS,
  assessmentSection: request.assessmentSection,
  rulePage: { path: RULE_PAGE, presence: request.presence },
});

const READINGS: Readonly<Record<AssessmentSection, Readonly<Record<FilePresence, ClauseReading>>>> = {
  present: { present: readingOf({ assessmentSection: "present", presence: "present" }), absent: readingOf({ assessmentSection: "present", presence: "absent" }) },
  "not-assessed": {
    present: readingOf({ assessmentSection: "not-assessed", presence: "present" }),
    absent: readingOf({ assessmentSection: "not-assessed", presence: "absent" }),
  },
  unread: { present: readingOf({ assessmentSection: "unread", presence: "present" }), absent: readingOf({ assessmentSection: "unread", presence: "absent" }) },
};

const NOTES: Readonly<Record<AssessmentFileNote["state"], AssessmentFileNote>> = {
  "not-written": { kind: "assessment-file", state: "not-written", guide: ADOPTION_GUIDE },
  unreadable: { kind: "assessment-file", state: "unreadable", guide: ADOPTION_GUIDE },
};

const PAID_DEBT_NOTES: readonly Filled<PaidDebtNote>[] = [
  { entry: { kind: "paid-debt", fileCarveOuts: 1, projections: [] }, fills: {} },
  { entry: { kind: "paid-debt", fileCarveOuts: 3, projections: [] }, fills: { count: "3" } },
  { entry: { kind: "paid-debt", fileCarveOuts: 1, projections: [MECHANISM] }, fills: {} },
  { entry: { kind: "paid-debt", fileCarveOuts: 3, projections: [MECHANISM] }, fills: { count: "3" } },
];

const SLICE_FOLDER = "packages/web";

const projectionFillsOf = (request: { readonly problem: ProjectionProblem }): Fills =>
  request.problem.scope === "slice" ? { slice: request.problem.slice, folder: SLICE_FOLDER } : {};

const unfilled = <Entry>(entries: readonly Entry[]): readonly Filled<Entry>[] => entries.map((entry) => ({ entry, fills: {} }));

const SECTION_SAMPLES: SectionSamples = {
  excluded: [{ entry: repoPathSchema.parse("generated"), fills: { path: "generated" } }],
  notAdopted: unfilled([LOOPS]),
  notRun: unfilled([LOOPS]),
  editions: [{ entry: EDITION_READING, fills: { edition: "1", latest: "2" } }],
  findings: [...unfilled([FINDING]), REMEDIED_FINDING],
  exempted: [
    ...Object.values(RECORDS).map((record) => ({ entry: { finding: FINDING, by: [record] }, fills: { "record kind": record.kind } })),
    ...Object.values(IMPORTED_RECORDS).map((imported) => ({ entry: { finding: FINDING, by: [imported.entry] }, fills: imported.fills })),
  ],
  uncovered: unfilled([LOOPS]),
  stale: unfilled(Object.values(RECORDS)),
  forfeited: unfilled([RECORDS["file-carve-out"]]),
  unrecorded: Object.values(NATIVE_EXCEPTIONS).flat(),
  doublyHeld: unfilled([{ clause: LOOPS, file: FILE, mechanism: MECHANISM }]),
  invalidRecords: [
    ...Object.values(RECORD_PROBLEMS).map((problem, index) => ({
      entry: { place: { layout: "single-file" as const, file: SINGLE_RECORDS_FILE, index }, problem: problem.entry },
      fills: { ...problem.fills, index: String(index) },
    })),
    ...Object.values(SPLIT_RECORD_PROBLEMS).map((problem, index) => ({
      entry: { place: { layout: "split" as const, file: SPLIT_RECORDS_FILE, index }, problem: problem.entry },
      fills: { ...problem.fills, index: String(index), "records file": SPLIT_RECORDS_FILE },
    })),
  ],
  unmeasured: Object.values(UNMEASURED).flat(),
  projectionProblems: Object.values(PROJECTION_PROBLEMS)
    .flatMap((byState) => Object.values(byState))
    .map((problem) => ({ entry: problem, fills: projectionFillsOf({ problem }) })),
  assessment: Object.values(PARTIAL_ASSESSMENTS).flatMap((byAssessor) => Object.values(byAssessor).flat()),
  readFirst: [...unfilled(Object.values(READINGS).flatMap((byPresence) => Object.values(byPresence))), ...PAID_DEBT_NOTES],
};

const EMPTY_REPORT: CheckReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
  findings: [],
  exempted: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  invalidRecords: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
  readFirst: [],
};

const entriesOf = <Entry>(samples: readonly Filled<Entry>[]): readonly Entry[] => samples.map((sample) => sample.entry);

const EVERY_ENTRY: CheckReport = {
  excluded: entriesOf(SECTION_SAMPLES.excluded),
  notAdopted: entriesOf(SECTION_SAMPLES.notAdopted),
  notRun: entriesOf(SECTION_SAMPLES.notRun),
  editions: entriesOf(SECTION_SAMPLES.editions),
  findings: entriesOf(SECTION_SAMPLES.findings),
  exempted: entriesOf(SECTION_SAMPLES.exempted),
  uncovered: entriesOf(SECTION_SAMPLES.uncovered),
  stale: entriesOf(SECTION_SAMPLES.stale),
  forfeited: entriesOf(SECTION_SAMPLES.forfeited),
  unrecorded: entriesOf(SECTION_SAMPLES.unrecorded),
  doublyHeld: entriesOf(SECTION_SAMPLES.doublyHeld),
  invalidRecords: entriesOf(SECTION_SAMPLES.invalidRecords),
  unmeasured: entriesOf(SECTION_SAMPLES.unmeasured),
  projectionProblems: entriesOf(SECTION_SAMPLES.projectionProblems),
  assessment: entriesOf(SECTION_SAMPLES.assessment),
  readFirst: entriesOf(SECTION_SAMPLES.readFirst),
};

const sampleFills: EntryFills = ({ section, position }) => ({ ...SHARED_FILLS, ...SECTION_SAMPLES[section][position]?.fills });

const sharedFills: EntryFills = () => SHARED_FILLS;

const unslicedFills: EntryFills = ({ position }) => ({ ...SHARED_FILLS, ...UNSLICED_UNRUN[position]?.fills });

const NOTED_REPORTS: readonly CheckReport[] = Object.values(NOTES).flatMap((note) => [
  { ...EMPTY_REPORT, findings: [FINDING], readFirst: [note, READINGS.unread.present] },
  { ...EMPTY_REPORT, findings: [FINDING], readFirst: [note, READINGS.unread.absent] },
]);

const VERDICT_REPORTS: Readonly<Record<Verdict, Readonly<Record<"whole" | "partial", CheckReport>>>> = {
  pass: { whole: EMPTY_REPORT, partial: { ...EMPTY_REPORT, assessment: [ONE_CARVE_OUT_ELSEWHERE] } },
  fail: { whole: { ...EMPTY_REPORT, findings: [FINDING] }, partial: { ...EMPTY_REPORT, findings: [FINDING], assessment: [ONE_CARVE_OUT_ELSEWHERE] } },
};

const EVERY_OUTPUT: readonly ReportOutput[] = reportOutputSchema.options;

const SYMPTOM_PAGE = "node_modules/@hailstails/hone/rules/typescript/symptoms.md";

const CHECKS_PAGE = "node_modules/@hailstails/hone/rules/CD-27/CHECKS.md";

const AUDIT = mechanismIdSchema.parse("audit");

const TEST_BODY_LOGIC = clauseAddressSchema.parse("CD-27#test-body-logic");

const TEST_FILE = repoPathSchema.parse("src/orders/charge-order.test.ts");

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const AT_A_BOUNDARY: Principle = { name: "external-behaviour-sits-at-a-boundary", title: "External behaviour sits at a boundary" };

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const PORTS_DECLARED_INSIDE: Rule = { name: "ports-declared-inside", title: "Ports declared inside", principle: AT_A_BOUNDARY, standing: "accepted" };

const WRITTEN_OUT_ANSWERS: Rule = { name: "written-out-answers", title: "Written-out answers", principle: TESTS_ARE_OURS, standing: "accepted" };

const DOER_OR_ORCHESTRATOR: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: ONE_PLACE_DECIDES, standing: "accepted" };

const STRAIGHT_THROUGH_TESTS: Rule = { name: "straight-through-tests", title: "Straight-through tests", principle: TESTS_ARE_OURS, standing: "accepted" };

const HANDED_WHAT_IT_USES: Rule = { name: "handed-what-it-uses", title: "Handed what it uses", principle: ONE_PLACE_DECIDES, standing: "accepted" };

const NEEDS_THE_CURRENT_TIME: Case = {
  name: "needs-the-current-time-a-random-value-a-new-id-or-an-outside-ordering",
  title: "Needs the current time, a random value, a new id or an outside ordering",
  standing: "accepted",
  owes: [{ kind: "principle", principle: AT_A_BOUNDARY }],
};

const DOES_ONE_JOB: Case = { name: "does-one-job", title: "Does one job", standing: "accepted", owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }] };

const CHECKS_A_VALUE: Case = {
  name: "checks-a-value-that-may-be-one-of-several-outcomes",
  title: "Checks a value that may be one of several outcomes",
  standing: "accepted",
  owes: [{ kind: "principle", principle: TESTS_ARE_OURS }],
};

const USES_WHAT_A_COLLABORATOR_GIVES_BACK: Case = {
  name: "uses-what-a-collaborator-gives-back",
  title: "Uses what a collaborator gives back",
  standing: "accepted",
  owes: [{ kind: "principle", principle: TESTS_ARE_OURS }],
};

const WORLD_VALUES_THROUGH_A_PORT: Recipe = {
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "\"the world reaches a unit through a port\"", standing: "accepted" },
};

const ASSERT_TO_NARROW: Recipe = { name: "assert-to-narrow", title: "Assert to narrow", standing: "accepted", reason: { text: "\"it narrows the type\"", standing: "accepted" } };

const ITEACH_OVER_TYPED_ROWS: Recipe = { name: "iteach-over-typed-rows", title: "it.each over typed rows", standing: "accepted", reason: { text: "\"each row is a case\"", standing: "accepted" } };

const BOUNDARY_RECORD: RecordKind = { name: "boundary-record", title: "Boundary record", phrase: "a boundary record", todaysFormat: "authorised-location" };

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const DEVIATION: RecordKind = { name: "deviation", title: "Deviation", phrase: "a deviation", todaysFormat: "none-yet" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DATE_USED_DIRECTLY: Symptom = {
  name: "date-used-directly",
  title: "Date used directly",
  seen: "Any use of `Date` outside the places that handle dates.",
  mayIndicate: [
    {
      case: NEEDS_THE_CURRENT_TIME,
      points: [
        { kind: "rule", rule: PORTS_DECLARED_INSIDE },
        { kind: "rule", rule: WRITTEN_OUT_ANSWERS },
      ],
    },
    { case: DOES_ONE_JOB, points: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] },
  ],
  breachUsuallySits: "in the unit that should be passed the time, often a doer doing two jobs",
  recipes: [WORLD_VALUES_THROUGH_A_PORT],
  correctUses: [{ situation: "correct use", kind: BOUNDARY_RECORD, at: "on the clock adapter" }],
};

const BRANCH_IN_A_TEST: Symptom = {
  name: "branch-in-a-test",
  title: "Branch in a test",
  seen: "`if` in a test file.",
  mayIndicate: [
    {
      case: CHECKS_A_VALUE,
      points: [
        { kind: "rule", rule: STRAIGHT_THROUGH_TESTS },
        { kind: "principle", principle: NO_HIDDEN_EFFECTS },
      ],
    },
  ],
  breachUsuallySits: "in the unit's output type, where optional or loose shapes force the test to branch",
  recipes: [ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  correctUses: [],
};

const DOUBLE_WITH_A_BODY: Symptom = {
  name: "double-with-a-body",
  title: "Double with a body",
  seen: "A double that has a function body.",
  mayIndicate: [{ case: USES_WHAT_A_COLLABORATOR_GIVES_BACK, points: [{ kind: "rule", rule: HANDED_WHAT_IT_USES }] }],
  breachUsuallySits: "in a port too wide",
  recipes: [],
  correctUses: [{ situation: "a fake, where a stub cannot do the test", kind: DEVIATION, at: "from Stub with vi.fn" }],
};

const SYMPTOM_GUIDE: SymptomGuide = {
  guide: "catalogue",
  page: SYMPTOM_PAGE,
  catalogue: {
    principles: [NO_HIDDEN_EFFECTS, TESTS_ARE_OURS, AT_A_BOUNDARY, ONE_PLACE_DECIDES],
    rules: [PORTS_DECLARED_INSIDE, WRITTEN_OUT_ANSWERS, DOER_OR_ORCHESTRATOR, STRAIGHT_THROUGH_TESTS, HANDED_WHAT_IT_USES],
    cases: [NEEDS_THE_CURRENT_TIME, DOES_ONE_JOB, CHECKS_A_VALUE, USES_WHAT_A_COLLABORATOR_GIVES_BACK],
    recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
    recordKinds: [AUTHORISED_LOCATION, BOUNDARY_RECORD, DEBT, DEVIATION],
    alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
    engines: [],
    symptoms: [DATE_USED_DIRECTLY, BRANCH_IN_A_TEST, DOUBLE_WITH_A_BODY],
    clauses: [
      { clause: clauseAddressSchema.parse("CD-17#clock-sources"), sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } },
      {
        clause: TEST_BODY_LOGIC,
        sight: {
          kind: "symptom-by-form",
          forms: [
            { section: "branching-with-if", symptom: BRANCH_IN_A_TEST },
            { section: "logic-inside-a-function-the-test-passes-on", symptom: DOUBLE_WITH_A_BODY },
          ],
        },
      },
    ],
    checks: [],
    namedBans: [],
  },
};

const SYMPTOM_FINDINGS: readonly Filled<Finding>[] = [
  {
    entry: {
      clause: clauseAddressSchema.parse("CD-17#clock-sources"),
      mechanism: AUDIT,
      file: repoPathSchema.parse("src/orders/charge-order.ts"),
      anchor: { line: 14, column: 0 },
      snippet: "const chargedAt = clock.now();",
    },
    fills: {
      clause: "CD-17#clock-sources",
      mechanism: "audit",
      file: "src/orders/charge-order.ts",
      line: "14",
      column: "0",
      snippet: "const chargedAt = clock.now();",
      symptom: "date-used-directly",
      indicated: "ports-declared-inside, written-out-answers, doer-or-orchestrator",
    },
  },
  {
    entry: {
      clause: TEST_BODY_LOGIC,
      mechanism: AUDIT,
      file: TEST_FILE,
      anchor: { line: 22, column: 2 },
      snippet: "if (result.ok) {",
      remedy: { fix: "write one test per case, or one it.each table", page: CHECKS_PAGE, section: "branching-with-if" },
    },
    fills: {
      clause: "CD-27#test-body-logic",
      mechanism: "audit",
      file: "src/orders/charge-order.test.ts",
      line: "22",
      column: "2",
      snippet: "if (result.ok) {",
      symptom: "branch-in-a-test",
      indicated: "straight-through-tests, no-hidden-effects",
      fix: "write one test per case, or one it.each table",
      "fix page": CHECKS_PAGE,
      section: "branching-with-if",
    },
  },
  {
    entry: {
      clause: TEST_BODY_LOGIC,
      mechanism: AUDIT,
      file: TEST_FILE,
      anchor: { line: 30, column: 4 },
      snippet: "kindOf: () => \"file\"",
      remedy: { fix: "make it a vi.fn spy", page: CHECKS_PAGE, section: "logic-inside-a-function-the-test-passes-on" },
    },
    fills: {
      clause: "CD-27#test-body-logic",
      mechanism: "audit",
      file: "src/orders/charge-order.test.ts",
      line: "30",
      column: "4",
      snippet: "kindOf: () => \"file\"",
      symptom: "double-with-a-body",
      indicated: "handed-what-it-uses",
      fix: "make it a vi.fn spy",
      "fix page": CHECKS_PAGE,
      section: "logic-inside-a-function-the-test-passes-on",
    },
  },
];

const SYMPTOM_NOTE_FILLS: readonly Fills[] = [
  {
    symptom: "date-used-directly",
    title: "Date used directly",
    indications: "needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator",
    breach: "in the unit that should be passed the time, often a doer doing two jobs",
    recipe: "World values through a port",
    answers: "Correct use: a boundary record on the clock adapter (today: authorised-location). Known debt: debt (today: file-carve-out)",
    "symptom page": SYMPTOM_PAGE,
  },
  {
    symptom: "branch-in-a-test",
    title: "Branch in a test",
    indications: "checks a value that may be one of several outcomes → Straight-through tests, No hidden effects",
    breach: "in the unit's output type, where optional or loose shapes force the test to branch",
    recipes: "Assert to narrow; it.each over typed rows",
    answers: "Known debt: debt (today: file-carve-out)",
    "symptom page": SYMPTOM_PAGE,
  },
  {
    symptom: "double-with-a-body",
    title: "Double with a body",
    indications: "uses what a collaborator gives back → Handed what it uses",
    breach: "in a port too wide",
    answers: "A fake, where a stub cannot do the test: a deviation from Stub with vi.fn (no record format yet). Known debt: debt (today: file-carve-out)",
    "symptom page": SYMPTOM_PAGE,
  },
];

const SYMPTOM_FILLS: Partial<Record<SectionName, readonly Fills[]>> = {
  findings: SYMPTOM_FINDINGS.map((sample) => sample.fills),
  readFirst: SYMPTOM_NOTE_FILLS,
};

const symptomFills: EntryFills = ({ section, position }) => ({ ...SYMPTOM_FILLS[section]?.[position] });

const SYMPTOM_CATALOGUE = "node_modules/@hailstails/hone/rules/typescript/symptoms.json";

const UNREAD_CATALOGUES: readonly Filled<UnreadableGuide>[] = [
  { entry: { guide: "unreadable", failure: `file-unreadable ${SYMPTOM_CATALOGUE} EACCES` }, fills: { path: SYMPTOM_CATALOGUE, detail: "EACCES" } },
  { entry: { guide: "unreadable", failure: `file-malformed ${SYMPTOM_CATALOGUE} Unexpected end` }, fills: { path: SYMPTOM_CATALOGUE, detail: "Unexpected end" } },
  { entry: { guide: "unreadable", failure: `unsupported-version ${SYMPTOM_CATALOGUE} 2` }, fills: { path: SYMPTOM_CATALOGUE, "version found": "2" } },
];

const REPORT_LINES: readonly PrintedLine[] = [
  ...EVERY_OUTPUT.flatMap((output) =>
    reportLinesOf({ report: EVERY_ENTRY, output, projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, entryFills: sampleFills, guide: NO_SYMPTOM_GUIDE }),
  ),
  ...reportLinesOf({
    report: { ...EMPTY_REPORT, unmeasured: entriesOf(UNSLICED_UNRUN) },
    output: "full",
    projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
    entryFills: unslicedFills,
    guide: NO_SYMPTOM_GUIDE,
  }),
  ...[...NOTED_REPORTS, ...Object.values(VERDICT_REPORTS).flatMap((byPart) => Object.values(byPart))].flatMap((report) =>
    reportLinesOf({ report, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, entryFills: sharedFills, guide: NO_SYMPTOM_GUIDE }),
  ),
  ...reportLinesOf({
    report: { ...EMPTY_REPORT, findings: entriesOf(SYMPTOM_FINDINGS) },
    output: "full",
    projectCommand: PROJECT_COMMAND,
    pruneCommand: PRUNE_COMMAND,
    entryFills: symptomFills,
    guide: SYMPTOM_GUIDE,
  }),
  ...UNREAD_CATALOGUES.flatMap((sample) =>
    reportLinesOf({
      report: EMPTY_REPORT,
      output: "full",
      projectCommand: PROJECT_COMMAND,
      pruneCommand: PRUNE_COMMAND,
      entryFills: () => sample.fills,
      guide: sample.entry,
    }),
  ),
];

const PEER = { packageName: "eslint", peer: "required", supported: "^9.0.0 || ^10.0.0", found: "8.57.0" } as const;

const PEER_FILLS: Fills = { package: "eslint", "version found": "8.57.0", range: "^9.0.0 || ^10.0.0" };

const RUNNER_FAILURES: { readonly [Kind in RunnerFailure["kind"]]: Filled<Extract<RunnerFailure, { readonly kind: Kind }>> } = {
  "piece-invalid": {
    entry: { kind: "piece-invalid", pieceRoot: "node_modules/@hailstails/hone/mechanisms/eslint/CD-1", detail: "no module" },
    fills: { "piece folder": "node_modules/@hailstails/hone/mechanisms/eslint/CD-1", detail: "no module" },
  },
  "file-unreadable": { entry: { kind: "file-unreadable", file: FILE, detail: "EACCES" }, fills: { detail: "EACCES" } },
  "file-unparseable": { entry: { kind: "file-unparseable", file: FILE, detail: "unexpected token" }, fills: { detail: "unexpected token" } },
  "tool-failed": { entry: { kind: "tool-failed", detail: "eslint exited 2" }, fills: { detail: "eslint exited 2" } },
  "plugin-conflict": { entry: { kind: "plugin-conflict", detail: "two copies of the plugin" }, fills: { detail: "two copies of the plugin" } },
  "team-config-unloadable": { entry: { kind: "team-config-unloadable", detail: "eslint.config.mjs threw" }, fills: { detail: "eslint.config.mjs threw" } },
  "runner-invalid-output": { entry: { kind: "runner-invalid-output", detail: "not an array" }, fills: { detail: "not an array" } },
  "toolchain-unavailable": { entry: { kind: "toolchain-unavailable", peers: [PEER] }, fills: PEER_FILLS },
  "toolchain-shadowed": {
    entry: {
      kind: "toolchain-shadowed",
      packageName: "eslint",
      location: "node_modules/@hailstails/hone/node_modules/eslint",
      installRoot: "node_modules/@hailstails/hone",
    },
    fills: { package: "eslint", location: "node_modules/@hailstails/hone/node_modules/eslint", "install folder": "node_modules/@hailstails/hone" },
  },
};

const UNAVAILABLE_TOOLCHAINS: readonly Filled<RunnerFailure>[] = [
  { entry: { kind: "toolchain-unavailable", peers: [{ ...PEER, found: "not installed" }] }, fills: PEER_FILLS },
  {
    entry: { kind: "toolchain-unavailable", peers: [PEER, { ...PEER, packageName: "typescript-eslint" }] },
    fills: { ...PEER_FILLS, "other package": "typescript-eslint" },
  },
];

export const RUNNER_FAILURE_SAMPLES: readonly Filled<RunnerFailure>[] = [...Object.values(RUNNER_FAILURES), ...UNAVAILABLE_TOOLCHAINS];

const LOAD_FAILURES: { readonly [Kind in LoadFailure["kind"]]: Filled<Extract<LoadFailure, { readonly kind: Kind }>> } = {
  "arguments-invalid": { entry: { kind: "arguments-invalid", detail: "--repo needs a value" }, fills: { detail: "--repo needs a value" } },
  "install-root-unresolvable": {
    entry: { kind: "install-root-unresolvable", url: "https://example.invalid/tool.js", detail: "not a file URL" },
    fills: { url: "https://example.invalid/tool.js", detail: "not a file URL" },
  },
  "file-unreadable": { entry: { kind: "file-unreadable", path: "disciplines.json", detail: "EACCES" }, fills: { path: "disciplines.json", detail: "EACCES" } },
  "file-malformed": {
    entry: { kind: "file-malformed", path: "disciplines.json", detail: "clauses is not an object" },
    fills: { path: "disciplines.json", detail: "clauses is not an object" },
  },
  "file-unwritable": {
    entry: { kind: "file-unwritable", path: "discipline-exceptions.json", detail: "EACCES" },
    fills: { path: "discipline-exceptions.json", detail: "EACCES" },
  },
  "why-chains-required": { entry: { kind: "why-chains-required", path: "disciplines.json" }, fills: { path: "disciplines.json" } },
  "records-in-both-layouts": {
    entry: { kind: "records-in-both-layouts", path: "discipline-exceptions.json", folder: "discipline-exceptions" },
    fills: { path: "discipline-exceptions.json", "records folder": "discipline-exceptions" },
  },
  "records-unsplittable": {
    entry: { kind: "records-unsplittable", path: "discipline-exceptions.json", detail: "exceptions[3] has the clause \"CD-15 loops\", which names no discipline" },
    fills: { path: "discipline-exceptions.json", detail: "exceptions[3] has the clause \"CD-15 loops\", which names no discipline" },
  },
  "unsupported-version": { entry: { kind: "unsupported-version", path: "disciplines.json", found: 2 }, fills: { path: "disciplines.json", "version found": "2" } },
  "reserved-rule-set-name": { entry: { kind: "reserved-rule-set-name", name: "hone" }, fills: { "rule set": "hone" } },
  "rule-set-name-collision": { entry: { kind: "rule-set-name-collision", name: "team", other: "team-web" }, fills: { "rule set": "team", "other rule set": "team-web" } },
  "duplicate-clause": {
    entry: { kind: "duplicate-clause", address: "CD-15#loops", prefixedAddress: "hone/CD-15#loops" },
    fills: { "clause with its rule set": "hone/CD-15#loops" },
  },
  "unknown-rule-set": { entry: { kind: "unknown-rule-set", name: "team" }, fills: { "rule set": "team" } },
  "unknown-discipline": { entry: { kind: "unknown-discipline", address: "CD-99#loops" }, fills: { clause: "CD-99#loops" } },
  "unknown-clause": { entry: { kind: "unknown-clause", address: "CD-15#whiles" }, fills: { clause: "CD-15#whiles" } },
  "judgement-clause-selected": { entry: { kind: "judgement-clause-selected", address: "CD-3#names" }, fills: { clause: "CD-3#names" } },
  "judgement-clause-listed": { entry: { kind: "judgement-clause-listed", address: "CD-3#names" }, fills: { clause: "CD-3#names" } },
  "mechanism-not-allowed": { entry: { kind: "mechanism-not-allowed", address: "CD-15#loops", mechanism: MECHANISM }, fills: {} },
  "runner-missing": { entry: { kind: "runner-missing", mechanism: MECHANISM }, fills: {} },
  "runner-invalid": { entry: { kind: "runner-invalid", mechanism: MECHANISM, detail: "no runner export" }, fills: { detail: "no runner export" } },
  "piece-missing": { entry: { kind: "piece-missing", address: "CD-15#loops", mechanism: MECHANISM }, fills: {} },
  "rule-set-invalid": {
    entry: { kind: "rule-set-invalid", path: "team/rules/TM-1/discipline.json", detail: "no clauses" },
    fills: { path: "team/rules/TM-1/discipline.json", detail: "no clauses" },
  },
  "git-failed": { entry: { kind: "git-failed", detail: "not a git repository" }, fills: { detail: "not a git repository" } },
  "config-root-untracked": { entry: { kind: "config-root-untracked", root: repoPathSchema.parse("packages/gone") }, fills: { "config root": "packages/gone" } },
  "selection-absent": { entry: { kind: "selection-absent", repo: "src" }, fills: { dir: "src" } },
  "unexpected-error": {
    entry: { kind: "unexpected-error", detail: "Cannot read properties of undefined" },
    fills: { detail: "Cannot read properties of undefined" },
  },
  "runner-failed": { entry: { kind: "runner-failed", mechanism: MECHANISM, failure: RUNNER_FAILURES["tool-failed"].entry }, fills: RUNNER_FAILURES["tool-failed"].fills },
};

const ARGUMENT_PROBLEMS: { readonly [Kind in ArgumentProblem["kind"]]: Filled<Extract<ArgumentProblem, { readonly kind: Kind }>> } = {
  "command-missing": { entry: { kind: "command-missing" }, fills: {} },
  "command-unknown": { entry: { kind: "command-unknown", given: "lint" }, fills: { given: "lint" } },
  "flag-extra": { entry: { kind: "flag-extra", flag: "--version", given: "extra" }, fills: { flag: "--version", given: "extra" } },
  "argument-unexpected": {
    entry: { kind: "argument-unexpected", subcommand: "check", given: "src" },
    fills: { command: "check", given: "src", option: "--repo", value: "<dir>" },
  },
  "option-unknown": { entry: { kind: "option-unknown", subcommand: "project", given: "--fix" }, fills: { command: "project", given: "--fix" } },
  "option-joined": { entry: { kind: "option-joined", option: REPO_OPTION, given: "--repo=src" }, fills: { option: "--repo", value: "<dir>", given: "--repo=src" } },
  "value-missing": { entry: { kind: "value-missing", option: REPO_OPTION }, fills: { option: "--repo", value: "<dir>" } },
  "option-repeated": { entry: { kind: "option-repeated", option: FORFEITURE_OPTION }, fills: { option: "--forfeiture" } },
  "option-required": { entry: { kind: "option-required", subcommand: "check", option: REPO_OPTION }, fills: { command: "check" } },
  "choice-invalid": {
    entry: { kind: "choice-invalid", option: FORFEITURE_OPTION, choices: ["this-run", "elsewhere"], given: "later" },
    fills: { option: "--forfeiture", values: "this-run or elsewhere", given: "later" },
  },
  "option-removed": { entry: { kind: "option-removed", given: "--waived-clauses", instead: WAIVED_CLAUSES_REPLACEMENT }, fills: {} },
  "repo-unresolvable": { entry: { kind: "repo-unresolvable", given: "src" }, fills: { dir: "src" } },
  "path-invalid": { entry: { kind: "path-invalid", option: LEAVE_OPTION, given: "src/*.ts" }, fills: { option: "--leave", given: "src/*.ts" } },
};

const failureLine = (request: { readonly label: string; readonly failure: LoadFailure; readonly fills: Fills }): PrintedLine => ({
  label: request.label,
  text: loadFailureText(request).trimEnd(),
  fills: { ...SHARED_FILLS, ...request.fills },
});

const FAILURE_LINES: readonly PrintedLine[] = [
  ...Object.values(LOAD_FAILURES).map((sample) => failureLine({ label: sample.entry.kind, failure: sample.entry, fills: sample.fills })),
  ...[...Object.values(RUNNER_FAILURES), ...UNAVAILABLE_TOOLCHAINS].map((sample) =>
    failureLine({ label: "runner-failed", failure: { kind: "runner-failed", mechanism: MECHANISM, failure: sample.entry }, fills: sample.fills }),
  ),
  ...Object.values(ARGUMENT_PROBLEMS).map((sample) =>
    failureLine({ label: sample.entry.kind, failure: argumentsInvalid({ problem: sample.entry }).error, fills: sample.fills }),
  ),
];

const PROJECTION_EFFECTS: Readonly<Record<ProjectionWrite["effect"], ProjectionWrite>> = {
  written: { path: repoPathSchema.parse("disciplines.eslint.mjs"), effect: "written" },
  unchanged: { path: repoPathSchema.parse("disciplines.eslint.mjs"), effect: "unchanged" },
  removed: { path: repoPathSchema.parse("disciplines.eslint.mjs"), effect: "removed" },
  "left-in-place": { path: repoPathSchema.parse("disciplines.eslint.mjs"), effect: "left-in-place" },
};

const linesOf = (request: { readonly label: string; readonly text: string; readonly fills: Fills }): readonly PrintedLine[] =>
  request.text
    .trimEnd()
    .split("\n")
    .map((text) => ({ label: request.label, text, fills: request.fills }));

const PROJECT_LINES: readonly PrintedLine[] = linesOf({
  label: "project",
  text: projectCommandOutcome({ result: { outcome: "ok", value: Object.values(PROJECTION_EFFECTS) } }).text,
  fills: { path: "disciplines.eslint.mjs" },
});

const LEFT_UNDER = repoPathSchema.parse("src");

const OWN_DISCIPLINES_FOLDER = repoPathSchema.parse("packages/legacy");

const OWN_CONFIGURATION_FOLDER = repoPathSchema.parse("packages/legacy/tools");

const INHERITED_DEBT_EFFECTS: Readonly<Record<InheritedDebtOutcome["effect"], InheritedDebtOutcome>> = {
  recorded: { clause: LOOPS, file: FILE, effect: "recorded" },
  "already-recorded": { clause: LOOPS, file: FILE, effect: "already-recorded", heldIn: SPLIT_RECORDS_FILE },
  left: { clause: LOOPS, file: FILE, effect: "left", under: LEFT_UNDER },
  "new-file": { clause: LOOPS, file: FILE, effect: "new-file" },
  refused: { clause: LOOPS, file: FILE, effect: "refused" },
  "nested-configuration": { clause: LOOPS, file: FILE, effect: "nested-configuration", under: OWN_CONFIGURATION_FOLDER, selectionFolder: OWN_DISCIPLINES_FOLDER, mechanism: MECHANISM },
};

const RECORD_DEBT_LINES: readonly PrintedLine[] = linesOf({
  label: "record-debt",
  text: recordDebtCommandOutcome({ result: { outcome: "ok", value: Object.values(INHERITED_DEBT_EFFECTS) } }).text,
  fills: { clause: "CD-15#loops", file: "src/basket.ts", path: "src", "records file": SPLIT_RECORDS_FILE, folder: OWN_DISCIPLINES_FOLDER, "config folder": OWN_CONFIGURATION_FOLDER, mechanism: MECHANISM },
});

const PRUNE_DEBT_LINES: readonly PrintedLine[] = linesOf({
  label: "prune-debt",
  text: pruneDebtCommandOutcome({ result: { outcome: "ok", value: [{ clause: LOOPS, file: FILE }] } }).text,
  fills: { clause: "CD-15#loops", file: "src/basket.ts" },
});

const SPLIT_RECORDS_OUTCOMES: readonly { readonly split: RecordsSplit; readonly path: string }[] = [
  { split: { effect: "split", writes: [{ path: SPLIT_RECORDS_FILE, effect: "written" }] }, path: SPLIT_RECORDS_FILE },
  { split: { effect: "split", writes: [{ path: SINGLE_RECORDS_FILE, effect: "removed" }] }, path: SINGLE_RECORDS_FILE },
  { split: { effect: "already-split", path: SPLIT_RECORDS_FOLDER }, path: SPLIT_RECORDS_FOLDER },
  { split: { effect: "no-records", path: SINGLE_RECORDS_FILE }, path: SINGLE_RECORDS_FILE },
];

const SPLIT_RECORDS_LINES: readonly PrintedLine[] = SPLIT_RECORDS_OUTCOMES.flatMap(({ split, path }) =>
  linesOf({ label: "split-records", text: splitRecordsCommandOutcome({ result: { outcome: "ok", value: split } }).text, fills: { path } }),
);

const VERSION_MANIFEST: FileTextPort = {
  read: () => ({ outcome: "ok", value: JSON.stringify({ name: "@hailstails/hone", version: "1.0.0" }) }),
  exists: () => "present",
  write: () => ({ outcome: "ok", value: undefined }),
};

const VERSION_LINES: readonly PrintedLine[] = linesOf({
  label: "version",
  text: versionCommandOutcome({
    result: installedVersionOf({
      fileText: VERSION_MANIFEST,
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      moduleUrl: "file:///install/src/hone.ts",
    }),
  }).text,
  fills: { version: "1.0.0" },
});

export const PRINTABLE_LINES: readonly PrintedLine[] = [
  ...REPORT_LINES,
  ...FAILURE_LINES,
  ...PROJECT_LINES,
  ...RECORD_DEBT_LINES,
  ...PRUNE_DEBT_LINES,
  ...SPLIT_RECORDS_LINES,
  ...UPGRADE_LINES,
  ...VERSION_LINES,
];

export const PRINTED_SECTION_ROLES: readonly DocumentedRole[] = SECTION_NAMES.map((section) => ({ section, role: sectionRoleOf({ section }) }));

const HELP_TOPICS: readonly HelpTopic[] = ["tool", ...SUBCOMMANDS];

const FENCE = "```";

export const PRINTED_BLOCKS: readonly string[] = [SYNOPSIS, ...HELP_TOPICS.map((topic) => helpText({ topic }))].map(
  (text) => `${FENCE}text\n${text}${FENCE}`,
);
