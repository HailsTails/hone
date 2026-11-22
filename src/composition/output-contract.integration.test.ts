import { describe, expect, it } from "vitest";

import type { AuthoriseRequest, Authorising } from "../application/ports/authorising.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { RecordsSplit } from "../application/ports/records/exception-repository.ts";
import type { PlanRefusal } from "../application/ports/upgrade/plan-refusal.ts";
import type { UpgradeFailure } from "../application/ports/upgrade/upgrade-stop.ts";
import type { VersionOneCommandRequest } from "../application/ports/version-one-command-request.ts";
import type { VersionOneCommandRequest as ToolCommandRequest } from "../application/ports/version-one-command-request.ts";
import { authorisingOf } from "../application/records/authorising.ts";
import type { AttributedNativeException, Finding } from "../domain/finding/governance.ts";
import type {
  Case,
  Check,
  Engine,
  Principle,
  Recipe,
  RecordKind,
  Rule,
  Symptom,
  SymptomCatalogue,
} from "../domain/language-layer/symptom-catalogue.ts";
import type { DebtOutcome } from "../domain/records/debt/debt-effects.ts";
import type { PrunedReason } from "../domain/records/debt/prunable-debt.ts";
import type {
  ExceptionRecord,
  ExistingAuthorisationProvenance,
  InheritedDebtProvenance,
  InvalidRecord,
} from "../domain/records/discipline-exceptions/exception-record.ts";
import type { InheritedDebtOutcome } from "../domain/records/discipline-exceptions/inherited-debt.ts";
import type { VersionOneWhyChain } from "../domain/records/discipline-exceptions/version-one-why-chain.ts";
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
  RecordsDocumentRefusal,
  SymptomReach,
} from "../domain/records/hone-records/hone-record.ts";
import type { RecordsUnmeasured } from "../domain/records/measurement/records-unmeasured.ts";
import type { WhyChain } from "../domain/records/why-chain.ts";
import type {
  AssessmentFileNote,
  AssessmentSection,
  CheckReport,
  ClausePage,
  ClauseReading,
  PaidDebtNote,
  PartialAssessment,
  ProjectionProblem,
  Unmeasured,
} from "../domain/report/check-report.ts";
import type { LoadFailure } from "../domain/report/load-failure.ts";
import {
  RUN_SECTION_NAMES,
  type RunSectionName,
  runSectionRoleOf,
} from "../domain/report/report-sections.ts";
import type { RunLoadFailure } from "../domain/report/run-load-failure.ts";
import type {
  EngineNotRun,
  RunProjectionProblem,
  RunReport,
  RunUnmeasured,
} from "../domain/report/run-report.ts";
import { SECTION_NAMES, type SectionName, sectionRoleOf } from "../domain/report/section-roles.ts";
import type { Verdict } from "../domain/report/verdict.ts";
import { absoluteRootOf } from "../domain/repository/absolute-root-of.ts";
import type { BaseRevisionAvailability } from "../domain/repository/base-revision-availability.ts";
import type { FilePresence } from "../domain/repository/file-presence.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../domain/rule-set/edition-of.ts";
import type { ClauseEditionReading } from "../domain/rule-set/edition-types.ts";
import { ruleSetNameOf } from "../domain/rule-set/rule-set-name-of.ts";
import type { MisnamedRuleId } from "../domain/runner/checks-run-report.ts";
import type { RunnerFailure } from "../domain/runner/runner-failure.ts";
import type {
  InlineReach,
  ProjectionWrite,
  ScriptOptionCause,
} from "../domain/runner/runner-result-types.ts";
import { WAIVED_CLAUSES_REPLACEMENT } from "../domain/settings/assessment.ts";
import type { ConventionKey } from "../domain/settings/conventions.ts";
import {
  REPORT_OUTPUTS,
  type ReportOutput,
  VERSION_TWO_REPORT_OUTPUTS,
  type VersionTwoReportOutput,
} from "../domain/settings/report-output.ts";
import {
  type ArgumentProblem,
  argumentsInvalid,
} from "../infrastructure/command-line/arguments/argument-problem.ts";
import { helpText, SYNOPSIS } from "../infrastructure/command-line/arguments/command-help.ts";
import {
  FORFEITURE_OPTION,
  type HelpTopic,
  LEAVE_OPTION,
  REPO_OPTION,
  SUBCOMMANDS,
} from "../infrastructure/command-line/arguments/command-line.ts";
import {
  RUN_SUBCOMMANDS,
  RUN_SYNOPSIS,
  type RunHelpTopic,
  runHelpText,
} from "../infrastructure/command-line/arguments/run-help.ts";
import { installedVersionOf } from "../infrastructure/command-line/installation/installed-version.ts";
import {
  projectCommandOutcome,
  versionCommandOutcome,
} from "../infrastructure/command-line/outcomes/command-outcome.ts";
import {
  pruneDebtCommandOutcome,
  recordDebtCommandOutcome,
  splitRecordsCommandOutcome,
} from "../infrastructure/command-line/outcomes/record-command-outcomes.ts";
import { clauseAddressSchema } from "../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";
import { recordsReader } from "../infrastructure/hone-records-folder/reading/records-reading.ts";
import { recordsEditor } from "../infrastructure/hone-records-folder/writing/records-edit.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import { runLoadFailureLine } from "../infrastructure/printed-report/load-failures/load-failure-lines.ts";
import {
  loadFailureDetail,
  loadFailureText,
} from "../infrastructure/printed-report/load-failures/load-failure-text.ts";
import {
  authorisingLines,
  debtOutcomeLine,
  projectNextLine,
  prunedDebtLine,
} from "../infrastructure/printed-report/records/record-command-lines.ts";
import {
  recordReferenceText,
  recordSubjectText,
} from "../infrastructure/printed-report/records/record-lines.ts";
import { renderGuidedReportText } from "../infrastructure/printed-report/report-text.ts";
import { renderRunReportText } from "../infrastructure/printed-report/run-report-text.ts";
import {
  NO_SYMPTOM_GUIDE,
  type SymptomGuide,
  type UnreadableGuide,
} from "../infrastructure/printed-report/symptoms/symptom-notes.ts";
import {
  UPGRADE_ISSUES_URL,
  upgradeFailureOutcomeOf,
} from "../infrastructure/printed-report/upgrade/upgrade-refusal-text.ts";
import {
  ALREADY_ON_VERSION_TWO,
  upgradeSuccessOutcomeOf,
} from "../infrastructure/printed-report/upgrade/upgrade-success-text.ts";
import { INSTALLED_PORTS, toolCommandOver } from "./run-tool-command.ts";

const commandRan = (command: ToolCommandRequest): Promise<void> =>
  toolCommandOver({ ...INSTALLED_PORTS, ...command })(command);

type Fills = Readonly<Record<string, string>>;

type DocumentedLine = {
  readonly label: string;
  readonly template: string;
};

type PrintedLine = {
  readonly label: string;
  readonly text: string;
  readonly fills: Fills;
};

type ContractGaps = {
  readonly undocumented: readonly PrintedLine[];
  readonly unprinted: readonly DocumentedLine[];
};

type DocumentedRole = {
  readonly section: string;
  readonly role: string;
};

type EntryFills<Section extends string = SectionName> = (request: {
  readonly section: Section;
  readonly position: number;
}) => Fills;

type ContractParts = { readonly versionOne: string; readonly versionTwo: string };

type Filled<Entry> = {
  readonly entry: Entry;
  readonly fills: Fills;
};

const VERSION_TWO_HEADING = "\n# Version 2\n";

const TEMPLATE_ROW = /^\| `([^`]+)` \| `([^`]+)` \|$/;

const ROLE_ROW = /^\| `([^`]+)` \| (failing|next-step|informational|guidance) \|/;

const PLACEHOLDER = /<([^<>]+)>/g;

const HEADING_LINE = /^(\S+) \((\d+)\)(?: |$)/;

const HEADING_LABEL = "heading";

const VERDICT_LABEL = "verdict";

const docLines = (request: { readonly text: string }): readonly string[] =>
  request.text.split("\n").map((line) => line.trimEnd());

const documentedLinesIn = (request: { readonly text: string }): readonly DocumentedLine[] =>
  docLines(request).flatMap((line) => {
    const row = TEMPLATE_ROW.exec(line);
    return row === null ? [] : [{ label: row[1], template: row[2] }];
  });

const documentedRolesIn = (request: { readonly text: string }): readonly DocumentedRole[] =>
  docLines(request).flatMap((line) => {
    const row = ROLE_ROW.exec(line);
    return row === null ? [] : [{ section: row[1], role: row[2] }];
  });

const VALUE_ROW = /^\| ((?:`<[^`]+>`(?:, )?)+) \|/;

const definedPlaceholdersIn = (request: { readonly text: string }): ReadonlySet<string> =>
  new Set(
    docLines(request).flatMap((line) =>
      [...(VALUE_ROW.exec(line)?.[1] ?? "").matchAll(PLACEHOLDER)].map(([, name]) => name),
    ),
  );

const UPGRADE_PLACEHOLDER_FORMS: Readonly<Record<string, RegExp>> = {
  "record kind": /^(?:file-carve-out|authorised-location|clause-wide-carve-out)$/,
  "new kind": /^(?:debt|authorised-location|not-adopted)$/,
  reason: /^[^\n]+$/,
  clause: /^(?:[a-z][a-z0-9-]*\/)?[A-Z][A-Za-z]*-\d+#[a-z][a-z0-9-]*$/,
  check: /^[a-z][a-z0-9-]*#[a-z][a-z0-9-]*$/,
  file: /^[^\n]+$/,
  line: /^[1-9]\d*$/,
  count: /^\d+$/,
  detail: /^[^\n]+$/,
  path: /^[^\n]+$/,
};

const filledTemplate = (request: { readonly template: string; readonly fills: Fills }): string =>
  request.template.replace(
    PLACEHOLDER,
    (placeholder: string, name: string) => request.fills[name] ?? placeholder,
  );

type Fit = "fits" | "misfits";

const fitOf = (request: {
  readonly printed: PrintedLine;
  readonly documented: DocumentedLine;
}): Fit =>
  request.printed.label === request.documented.label &&
  filledTemplate({ template: request.documented.template, fills: request.printed.fills }) ===
    request.printed.text
    ? "fits"
    : "misfits";

const contractGaps = (request: {
  readonly documented: readonly DocumentedLine[];
  readonly printed: readonly PrintedLine[];
}): ContractGaps => ({
  undocumented: request.printed.filter((printed) =>
    request.documented.every((documented) => fitOf({ printed, documented }) === "misfits"),
  ),
  unprinted: request.documented.filter((documented) =>
    request.printed.every((printed) => fitOf({ printed, documented }) === "misfits"),
  ),
});

type Attribution<Section extends string> = {
  readonly section: Section | undefined;
  readonly position: number;
  readonly lines: readonly PrintedLine[];
};

type Heading<Section extends string> = { readonly section: Section; readonly count: string };

const headingOf = <Section extends string>(request: {
  readonly line: string;
  readonly sections: readonly Section[];
}): Heading<Section> | undefined => {
  const heading = HEADING_LINE.exec(request.line);
  const section = request.sections.find((name) => name === heading?.[1]);
  return section === undefined || heading === null ? undefined : { section, count: heading[2] };
};

const attributed =
  <Section extends string>(request: {
    readonly entryFills: EntryFills<Section>;
    readonly sections: readonly Section[];
    readonly first: Section;
  }) =>
  (sofar: Attribution<Section>, line: string): Attribution<Section> => {
    const heading = headingOf({ line, sections: request.sections });
    if (heading !== undefined) {
      const fills = { section: heading.section, count: heading.count };
      return {
        section: heading.section,
        position: 0,
        lines: [...sofar.lines, { label: HEADING_LABEL, text: line, fills }],
      };
    }
    const section = sofar.section ?? request.first;
    const fills = request.entryFills({ section, position: sofar.position });
    return {
      ...sofar,
      position: sofar.position + 1,
      lines: [...sofar.lines, { label: section, text: line, fills }],
    };
  };

const sectionedLinesOf = <Section extends string>(request: {
  readonly text: string;
  readonly sections: readonly Section[];
  readonly first: Section;
  readonly entryFills: EntryFills<Section>;
}): readonly PrintedLine[] => {
  const lines = request.text.split("\n").slice(0, -1);
  const start: Attribution<Section> = { section: undefined, position: 0, lines: [] };
  const entries = lines.slice(0, -1).reduce(attributed(request), start);
  return [...entries.lines, { label: VERDICT_LABEL, text: lines.at(-1) ?? "", fills: {} }];
};

const reportLinesOf = (request: {
  readonly report: CheckReport;
  readonly output: ReportOutput;
  readonly projectCommand: string;
  readonly pruneCommand: string;
  readonly entryFills: EntryFills;
  readonly guide: SymptomGuide;
}): readonly PrintedLine[] =>
  sectionedLinesOf({
    text: renderGuidedReportText(request),
    sections: SECTION_NAMES,
    first: "excluded",
    entryFills: request.entryFills,
  });

const contractPartsOf = (request: { readonly text: string }): ContractParts => {
  const at = request.text.indexOf(VERSION_TWO_HEADING);
  return at === -1
    ? { versionOne: request.text, versionTwo: "" }
    : { versionOne: request.text.slice(0, at + 1), versionTwo: request.text.slice(at + 1) };
};

const contractTextAt = (request: { readonly path: string }): string => {
  const text = createDefaultFileTextPort({}).read(request);
  return text.outcome === "ok" ? text.value : "";
};

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const AUDIT = "walker" as const;

const ESLINT = "eslint" as const;

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const SYMPTOM_PAGE = "node_modules/@hailstails/hone/rules/typescript/symptoms.md";

const CHECKS_PAGE =
  "node_modules/@hailstails/hone/rules/typescript/symptoms/branch-in-a-test/test-body.md";

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const AT_A_BOUNDARY: Principle = {
  name: "external-behaviour-sits-at-a-boundary",
  title: "External behaviour sits at a boundary",
};

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const PORTS_DECLARED_INSIDE: Rule = {
  name: "ports-declared-inside",
  title: "Ports declared inside",
  principle: AT_A_BOUNDARY,
  standing: "accepted",
};

const WRITTEN_OUT_ANSWERS: Rule = {
  name: "written-out-answers",
  title: "Written-out answers",
  principle: TESTS_ARE_OURS,
  standing: "accepted",
};

const DOER_OR_ORCHESTRATOR: Rule = {
  name: "doer-or-orchestrator",
  title: "Doer or orchestrator",
  principle: ONE_PLACE_DECIDES,
  standing: "accepted",
};

const STRAIGHT_THROUGH_TESTS: Rule = {
  name: "straight-through-tests",
  title: "Straight-through tests",
  principle: TESTS_ARE_OURS,
  standing: "accepted",
};

const DECLARED_NOT_ASSERTED: Rule = {
  name: "declared-not-asserted",
  title: "Declared, not asserted",
  principle: ONE_PLACE_DECIDES,
  standing: "accepted",
};

const NEEDS_THE_CURRENT_TIME: Case = {
  name: "needs-the-current-time-a-random-value-a-new-id-or-an-outside-ordering",
  title: "Needs the current time, a random value, a new id or an outside ordering",
  standing: "accepted",
  owes: [{ kind: "principle", principle: AT_A_BOUNDARY }],
};

const DOES_ONE_JOB: Case = {
  name: "does-one-job",
  title: "Does one job",
  standing: "accepted",
  owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }],
};

const CHECKS_A_VALUE: Case = {
  name: "checks-a-value-that-may-be-one-of-several-outcomes",
  title: "Checks a value that may be one of several outcomes",
  standing: "accepted",
  owes: [{ kind: "principle", principle: TESTS_ARE_OURS }],
};

const OWED_DECLARED_NOT_ASSERTED = { kind: "rule", rule: DECLARED_NOT_ASSERTED } as const;

const GIVES_A_VALUE_ITS_TYPE: Case = {
  name: "gives-a-value-its-type",
  title: "Gives a value its type",
  standing: "accepted",
  owes: [OWED_DECLARED_NOT_ASSERTED],
};

const WORLD_VALUES_THROUGH_A_PORT: Recipe = {
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "the world reaches a unit through a port", standing: "accepted" },
};

const ASSERT_TO_NARROW: Recipe = {
  name: "assert-to-narrow",
  title: "Assert to narrow",
  standing: "accepted",
  reason: { text: "it narrows the type", standing: "accepted" },
};

const ITEACH_OVER_TYPED_ROWS: Recipe = {
  name: "iteach-over-typed-rows",
  title: "it.each over typed rows",
  standing: "accepted",
  reason: { text: "each row is a case", standing: "accepted" },
};

const BOUNDARY_RECORD_KIND: RecordKind = {
  name: "boundary-record",
  title: "Boundary record",
  phrase: "a boundary record",
  todaysFormat: "authorised-location",
};

const DEBT_KIND: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION_KIND: RecordKind = {
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
  correctUses: [
    { situation: "correct use", kind: BOUNDARY_RECORD_KIND, at: "on the clock adapter" },
  ],
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
  breachUsuallySits:
    "in the unit's output type, where optional or loose shapes force the test to branch",
  recipes: [ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  correctUses: [],
};

const CLAIMED_TYPE: Symptom = {
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [
    {
      case: GIVES_A_VALUE_ITS_TYPE,
      situation: "or needs it narrower",
      points: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
    },
  ],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [{ situation: "a schema proves the type", kind: AUTHORISED_LOCATION_KIND }],
};

const CLOCK_SOURCES = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-17"),
  clause: clauseIdOf("clock-sources"),
};

const TEST_BODY_LOGIC = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const CAST_EXPRESSIONS = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-2"),
  clause: clauseIdOf("cast-expressions"),
};

const TEAM_CLAUSE = {
  ruleSet: { name: ruleSetNameOf("acme") },
  discipline: disciplineIdOf("AC-1"),
  clause: clauseIdOf("no-moment"),
};

const CLOCK_CHECK: Check = {
  name: "clock-sources",
  symptom: DATE_USED_DIRECTLY,
  clause: CLOCK_SOURCES,
  engines: [WALKER],
  forms: [],
};

const TEST_BODY_CHECK: Check = {
  name: "test-body",
  symptom: BRANCH_IN_A_TEST,
  clause: TEST_BODY_LOGIC,
  engines: [WALKER],
  forms: ["branching-with-if"],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  clause: CAST_EXPRESSIONS,
  engines: [ESLINT_ENGINE],
  forms: [],
};

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [TESTS_ARE_OURS, AT_A_BOUNDARY, ONE_PLACE_DECIDES, NO_HIDDEN_EFFECTS],
  rules: [
    PORTS_DECLARED_INSIDE,
    WRITTEN_OUT_ANSWERS,
    DOER_OR_ORCHESTRATOR,
    STRAIGHT_THROUGH_TESTS,
    DECLARED_NOT_ASSERTED,
  ],
  cases: [NEEDS_THE_CURRENT_TIME, DOES_ONE_JOB, CHECKS_A_VALUE, GIVES_A_VALUE_ITS_TYPE],
  recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  recordKinds: [AUTHORISED_LOCATION_KIND, BOUNDARY_RECORD_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [DATE_USED_DIRECTLY, BRANCH_IN_A_TEST, CLAIMED_TYPE],
  clauses: [
    { clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } },
    {
      clause: TEST_BODY_LOGIC,
      sight: {
        kind: "symptom-by-form",
        forms: [{ section: "branching-with-if", symptom: BRANCH_IN_A_TEST }],
      },
    },
    { clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } },
  ],
  checks: [CLOCK_CHECK, TEST_BODY_CHECK, CAST_CHECK],
  namedBans: [{ outsideDependency: "lodash" }],
};

const CAUSAL_WHY_CHAIN: WhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because:
        "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because:
        "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because:
        "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because:
        "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because:
        "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause:
    "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootEvidence:
    "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const VERSION_ONE_CAUSAL_WHY_CHAIN: VersionOneWhyChain = {
  whys: CAUSAL_WHY_CHAIN.whys,
  rootCause: CAUSAL_WHY_CHAIN.rootCause,
  rootCheck: CAUSAL_WHY_CHAIN.rootEvidence,
  readback: CAUSAL_WHY_CHAIN.readback,
  owner: CAUSAL_WHY_CHAIN.owner,
};

const { UPGRADE_LINES, UPGRADE_SUCCESS_LINES } = (() => {
  const REPO = absoluteRootOf("/repo");

  const SETTINGS = absoluteRootOf("/repo/hone.config.json");

  const OLD_FILE = absoluteRootOf("/repo/disciplines.eslint.mjs");

  const CLAUSE = "CD-15#loops";

  const FILE = repoPathOf("src/a.ts");

  const MECHANISM = "eslint" as const;

  const CONFIG = repoPathOf("eslint.config.mjs");

  const PROJECTION = repoPathOf("disciplines.eslint.mjs");

  const SLICE = repoPathOf("packages/a/disciplines.eslint.mjs");

  const SLICE_CONFIG = repoPathOf("packages/a/eslint.config.mjs");

  const UNREADABLE: LoadFailure = {
    kind: "git-failed",
    detail: "git ls-files: not a git repository",
  };

  type Sample = { readonly failure: UpgradeFailure; readonly fills: Fills };

  const BASE_FILLS: Fills = {
    "issues page": UPGRADE_ISSUES_URL,
    clause: CLAUSE,
    file: FILE,
    "config file": CONFIG,
    projection: PROJECTION,
    detail: "the detail",
    path: SETTINGS,
    specifier: "./disciplines.eslint.mjs",
  };

  const planRefused = (request: { readonly refusal: PlanRefusal }): UpgradeFailure => ({
    kind: "plan-refused",
    refusal: request.refusal,
    removedByVersionOne: [],
  });

  const SAMPLES: readonly Sample[] = [
    {
      failure: {
        kind: "oracle-failed",
        failure: { kind: "version-one-run-failed", detail: "the detail" },
      },
      fills: {},
    },
    {
      failure: {
        kind: "oracle-failed",
        failure: { kind: "finding-not-attributable", clause: CLAUSE, file: FILE, check: undefined },
      },
      fills: {},
    },
    {
      failure: {
        kind: "oracle-failed",
        failure: { kind: "record-doubly-held", clause: CLAUSE, file: FILE },
      },
      fills: {},
    },
    {
      failure: {
        kind: "oracle-failed",
        failure: { kind: "projection-not-current", file: SLICE, state: "out-of-date" },
      },
      fills: { projection: SLICE, state: "out-of-date" },
    },
    {
      failure: {
        kind: "oracle-failed",
        failure: { kind: "projection-not-current", file: SLICE, state: "missing" },
      },
      fills: { projection: SLICE, state: "missing" },
    },
    {
      failure: {
        kind: "oracle-failed",
        failure: { kind: "projection-not-current", file: SLICE, state: "not-applied" },
      },
      fills: { projection: SLICE, state: "not-applied" },
    },
    {
      failure: planRefused({
        refusal: { kind: "carve-out-unanswered", clause: CLAUSE, file: FILE },
      }),
      fills: {},
    },
    {
      failure: planRefused({
        refusal: { kind: "location-unanswered", clause: CLAUSE, file: FILE },
      }),
      fills: {},
    },
    {
      failure: planRefused({
        refusal: {
          kind: "mapping-refused",
          refusals: [
            { kind: "clause-without-check", clause: CLAUSE },
            { kind: "no-engine-on-mechanism", check: "loop-keyword#loops", mechanism: MECHANISM },
            {
              kind: "two-engines-on-mechanism",
              check: "loop-keyword#loops",
              mechanism: MECHANISM,
              engines: ["eslint", "oxlint"],
            },
            { kind: "record-answers-nothing", clause: CLAUSE, file: FILE, credited: "nothing" },
            {
              kind: "record-answers-nothing",
              clause: CLAUSE,
              file: FILE,
              credited: "suppression-only",
            },
            { kind: "records-name-refused", name: "Not A Name" },
          ],
        },
      }),
      fills: {
        check: "loop-keyword#loops",
        mechanism: "eslint",
        engines: "eslint or oxlint",
        name: "Not A Name",
      },
    },
    {
      failure: planRefused({
        refusal: {
          kind: "projection-failed",
          failure: { kind: "unknown-check", check: "names#names" },
        },
      }),
      fills: { detail: "load failure: unknown-check names#names" },
    },
    {
      failure: planRefused({
        refusal: {
          kind: "projection-failed",
          failure: {
            kind: "not-ready-yet",
            what: { thing: "eslint-config-roots", paths: ["vendor/lib"] },
          },
        },
      }),
      fills: {
        detail:
          "load failure: not-ready-yet eslint-config-roots: this release does not run a repository that holds other version 2 repositories yet; folders holding hone.config.json: vendor/lib; move them out of this repository, and run each on its own with --repo",
      },
    },
    {
      failure: planRefused({
        refusal: {
          kind: "projections-unpaired",
          refusal: {
            kind: "version-one-projection-unpaired",
            projection: SLICE,
            config: SLICE_CONFIG,
            folder: "packages/a",
          },
        },
      }),
      fills: { projection: SLICE, folder: "packages/a", "config file": SLICE_CONFIG },
    },
    {
      failure: planRefused({
        refusal: {
          kind: "projections-unpaired",
          refusal: {
            kind: "version-two-projection-unpaired",
            file: repoPathOf("packages/a/hone.eslint.mjs"),
            folder: "packages/a",
          },
        },
      }),
      fills: { file: "packages/a/hone.eslint.mjs", folder: "packages/a" },
    },
    {
      failure: planRefused({ refusal: { kind: "slice-left-in-place", files: [SLICE] } }),
      fills: { projection: SLICE },
    },
    {
      failure: planRefused({
        refusal: {
          kind: "reach-beyond-entries",
          records: [{ symptom: "loop-keyword#loops", file: "src/b.ts" }],
        },
      }),
      fills: { records: "loop-keyword#loops in src/b.ts" },
    },
    {
      failure: planRefused({
        refusal: {
          kind: "config-import-refused",
          refusal: { kind: "no-projection-import", file: SLICE_CONFIG, projection: SLICE },
        },
      }),
      fills: { "config file": SLICE_CONFIG, projection: SLICE },
    },
    {
      failure: planRefused({
        refusal: {
          kind: "config-import-refused",
          refusal: { kind: "several-projection-imports", file: CONFIG, count: 2 },
        },
      }),
      fills: { count: "2" },
    },
    {
      failure: planRefused({
        refusal: {
          kind: "config-import-refused",
          refusal: { kind: "projection-named-elsewhere", file: CONFIG },
        },
      }),
      fills: {},
    },
    {
      failure: planRefused({
        refusal: {
          kind: "team-config-refused",
          refusal: { kind: "no-file-imports-projection", projection: PROJECTION },
        },
      }),
      fills: {},
    },
    {
      failure: planRefused({
        refusal: {
          kind: "team-config-refused",
          refusal: { kind: "config-candidate-unreadable", file: CONFIG, detail: "the detail" },
        },
      }),
      fills: {},
    },
    {
      failure: {
        kind: "plan-refused",
        refusal: { kind: "slice-left-in-place", files: [SLICE] },
        removedByVersionOne: [repoPathOf("old/disciplines.eslint.mjs")],
      },
      fills: { projection: SLICE, "removed path": "/repo/old/disciplines.eslint.mjs" },
    },
    {
      failure: {
        kind: "version-one-run-failed",
        failure: { kind: "run-failed", detail: "the detail" },
        removedByVersionOne: [],
      },
      fills: {},
    },
    {
      failure: {
        kind: "version-one-uncovered",
        clauses: [
          clauseAddressSchema.parse(CLAUSE),
          {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-2"),
            clause: clauseIdOf("claimed-type"),
          },
        ],
        removedByVersionOne: [],
      },
      fills: { clauses: "CD-15#loops, CD-2#claimed-type" },
    },
    {
      failure: {
        kind: "version-one-project-failed",
        detail: "the detail",
        removedByVersionOne: [],
      },
      fills: {},
    },
    {
      failure: {
        kind: "version-one-project-rewrote",
        files: [PROJECTION, SLICE],
        removedByVersionOne: [],
      },
      fills: { files: "disciplines.eslint.mjs, packages/a/disciplines.eslint.mjs" },
    },
    {
      failure: {
        kind: "version-one-project-rewrote",
        files: [PROJECTION],
        removedByVersionOne: [repoPathOf("old/disciplines.eslint.mjs")],
      },
      fills: {
        files: "disciplines.eslint.mjs",
        "removed path": "/repo/old/disciplines.eslint.mjs",
      },
    },
    { failure: { kind: "unplaceable-path", file: FILE, removedByVersionOne: [] }, fills: {} },
    {
      failure: {
        kind: "unplaceable-path",
        file: FILE,
        removedByVersionOne: [repoPathOf("old/disciplines.eslint.mjs")],
      },
      fills: { "removed path": "/repo/old/disciplines.eslint.mjs" },
    },
    {
      failure: {
        kind: "removal-refused",
        failure: { kind: "records-file-outside-root", path: OLD_FILE, root: REPO },
        removedByVersionOne: [],
      },
      fills: { root: REPO, path: OLD_FILE },
    },
    {
      failure: {
        kind: "write-refused",
        refusal: { failure: { kind: "path-already-exists", path: SETTINGS }, unrestored: [] },
        removedByVersionOne: [],
      },
      fills: {},
    },
    {
      failure: {
        kind: "write-refused",
        refusal: {
          failure: { kind: "replaced-file-unreadable", path: SETTINGS, detail: "the detail" },
          unrestored: [],
        },
        removedByVersionOne: [],
      },
      fills: {},
    },
    {
      failure: {
        kind: "write-refused",
        refusal: {
          failure: { kind: "directory-uncreatable", path: SETTINGS, detail: "the detail" },
          unrestored: [],
        },
        removedByVersionOne: [],
      },
      fills: {},
    },
    {
      failure: {
        kind: "write-refused",
        refusal: {
          failure: { kind: "unwritable", path: SETTINGS, detail: "the detail" },
          unrestored: [{ written: "file-created", path: OLD_FILE, detail: "EBUSY" }],
        },
        removedByVersionOne: [],
      },
      fills: { "unrestored path": OLD_FILE, "unrestored detail": "EBUSY" },
    },
    {
      failure: {
        kind: "write-refused",
        refusal: {
          failure: { kind: "unwritable", path: SETTINGS, detail: "the detail" },
          unrestored: [{ written: "directory-created", path: OLD_FILE, detail: "EACCES" }],
        },
        removedByVersionOne: [],
      },
      fills: { "unrestored path": OLD_FILE, "unrestored detail": "EACCES" },
    },
    {
      failure: {
        kind: "write-refused",
        refusal: {
          failure: { kind: "unwritable", path: SETTINGS, detail: "the detail" },
          unrestored: [{ written: "file-replaced", path: OLD_FILE, detail: "EPERM" }],
        },
        removedByVersionOne: [],
      },
      fills: { "unrestored path": OLD_FILE, "unrestored detail": "EPERM" },
    },
    {
      failure: {
        kind: "version-two-run-failed",
        failure: { kind: "run-failed", detail: "the detail" },
        unrestored: [],
        removedByVersionOne: [],
      },
      fills: {},
    },
    {
      failure: {
        kind: "differences",
        differences: [
          {
            section: "findings",
            onlyBefore: ["CD-15#loops src/a.ts 3:1"],
            onlyAfter: ["CD-15#loops src/a.ts 4:1"],
          },
        ],
        unrestored: [],
        removedByVersionOne: [],
      },
      fills: {
        section: "findings",
        before: "CD-15#loops src/a.ts 3:1",
        after: "CD-15#loops src/a.ts 4:1",
      },
    },
    {
      failure: {
        kind: "directives-name-no-check",
        directives: [
          {
            kind: "names-no-check",
            ruleId: "hone/no-such-check",
            file: FILE,
            line: 3,
            text: "the text",
          },
        ],
        unrestored: [],
        removedByVersionOne: [],
      },
      fills: { line: "3", "rule id": "hone/no-such-check" },
    },
    {
      failure: {
        kind: "directives-name-no-check",
        directives: [
          {
            kind: "version-1-id",
            ruleId: "hone/no-class-authoring",
            file: FILE,
            line: 3,
            text: "the text",
            replacedBy: ["hone/authored-class-or-this#class-keyword"],
          },
        ],
        unrestored: [],
        removedByVersionOne: [],
      },
      fills: {
        line: "3",
        "rule id": "hone/no-class-authoring",
        "version 2 rule id": "hone/authored-class-or-this#class-keyword",
      },
    },
    {
      failure: {
        kind: "directives-name-no-check",
        directives: [
          {
            kind: "version-1-id",
            ruleId: "hone/no-class-authoring",
            file: FILE,
            line: 3,
            text: "the text",
            replacedBy: ["hone/a#first", "hone/a#second"],
          },
        ],
        unrestored: [],
        removedByVersionOne: [],
      },
      fills: {
        line: "3",
        "rule id": "hone/no-class-authoring",
        "version 2 rule ids": "hone/a#first, hone/a#second",
      },
    },
    {
      failure: {
        kind: "records-refused",
        refusal: {
          kind: "invalid-records",
          invalid: [
            {
              place: {
                layout: "split",
                file: repoPathOf("discipline-exceptions/file-carve-outs/cd-15.json"),
                index: 1,
              },
              problem: { kind: "clause-unparseable", detail: "the detail" },
            },
          ],
        },
      },
      fills: {
        "records file": "discipline-exceptions/file-carve-outs/cd-15.json",
        index: "1",
        problem: "clause-unparseable",
      },
    },
    {
      failure: {
        kind: "records-refused",
        refusal: {
          kind: "entry-not-json",
          place: {
            layout: "single-file",
            file: repoPathOf("discipline-exceptions.json"),
            index: 0,
          },
        },
      },
      fills: { "records file": "discipline-exceptions.json" },
    },
    {
      failure: { kind: "version-one-unreadable", failure: UNREADABLE },
      fills: { detail: loadFailureDetail({ failure: UNREADABLE }) },
    },
    {
      failure: {
        kind: "removal-failed",
        failure: {
          kind: "unremovable",
          path: OLD_FILE,
          detail: "the detail",
          removed: { files: [], folders: [] },
        },
        written: [repoPathOf("hone.config.json"), repoPathOf("hone.eslint.mjs")],
        replaced: [CONFIG, SLICE_CONFIG],
        remaining: [OLD_FILE],
      },
      fills: {
        written: "hone.config.json, hone.eslint.mjs",
        replaced: "eslint.config.mjs, packages/a/eslint.config.mjs",
        "removal path": OLD_FILE,
        "remaining path": OLD_FILE,
      },
    },
    {
      failure: {
        kind: "removal-failed",
        failure: { kind: "records-file-outside-root", path: OLD_FILE, root: REPO },
        written: [repoPathOf("hone.config.json")],
        replaced: [],
        remaining: [OLD_FILE],
      },
      fills: {
        written: "hone.config.json",
        "removal path": OLD_FILE,
        root: REPO,
        "remaining path": OLD_FILE,
      },
    },
  ];

  const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

  const linesOf = (request: {
    readonly text: string;
    readonly fills: Fills;
  }): readonly PrintedLine[] =>
    request.text
      .trimEnd()
      .split("\n")
      .map((text) => ({ label: "upgrade", text, fills: request.fills }));

  const SUCCESS_TEXT = upgradeSuccessOutcomeOf({
    repoRoot: REPO,
    path: PATH,
    carried: {
      written: [repoPathOf("hone.config.json")],
      replaced: [CONFIG],
      removed: {
        files: [absoluteRootOf("/repo/disciplines.json")],
        folders: [absoluteRootOf("/repo/discipline-exceptions")],
      },
      records: [
        {
          recordKind: "file-carve-out",
          clause: CLOCK_SOURCES,
          file: repoPathOf("src/a.ts"),
          newKind: "debt",
          check: CLOCK_CHECK,
          holding: "stated",
        },
        {
          recordKind: "authorised-location",
          clause: CAST_EXPRESSIONS,
          file: repoPathOf("src/b.ts"),
          newKind: "authorised-location",
          check: CAST_CHECK,
          holding: "carried",
        },
        { recordKind: "clause-wide-carve-out", clause: CAST_EXPRESSIONS, reason: "generated code" },
        {
          recordKind: "clause-wide-carve-out",
          clause: CAST_EXPRESSIONS,
          newKind: "not-adopted",
          check: CAST_CHECK,
        },
      ],
      findings: 3,
      mentions: [{ file: repoPathOf("package.json"), line: 4 }],
      unread: [
        { file: repoPathOf("vendor/lib"), detail: "EISDIR: illegal operation on a directory" },
      ],
    },
  }).text;

  type LineFills = {
    readonly marker: RegExp;
    readonly fills: (text: string) => Fills;
  };

  const wordsOf = (text: string): readonly string[] => text.split(" ");

  const SUCCESS_LINE_FILLS: readonly LineFills[] = [
    {
      marker: /^upgrade: same findings/,
      fills: () => ({ count: "3" }),
    },
    {
      marker: /^mention-unread /,
      fills: (text) => ({ file: wordsOf(text)[1] ?? "", detail: wordsOf(text).slice(2).join(" ") }),
    },
    {
      marker: /^mention /,
      fills: (text) => ({
        file: text.slice(text.indexOf(" ") + 1, text.lastIndexOf(":")),
        line: text.slice(text.lastIndexOf(":") + 1),
      }),
    },
    {
      marker: /^reason /,
      fills: (text) => ({
        clause: wordsOf(text)[1]?.slice(0, -1) ?? "",
        reason: wordsOf(text).slice(2).join(" "),
      }),
    },
    {
      marker: /^carried /,
      fills: (text) => ({ check: wordsOf(text)[1] ?? "", file: wordsOf(text)[2] ?? "" }),
    },
    {
      marker: /^clause-wide-carve-out \S+ -> /,
      fills: (text) => ({
        "record kind": wordsOf(text)[0] ?? "",
        clause: wordsOf(text)[1] ?? "",
        "new kind": wordsOf(text)[3] ?? "",
        check: wordsOf(text)[4] ?? "",
      }),
    },
    {
      marker: / -> /,
      fills: (text) => ({
        "record kind": wordsOf(text)[0] ?? "",
        clause: wordsOf(text)[1] ?? "",
        file: wordsOf(text)[2] ?? "",
        "new kind": wordsOf(text)[4] ?? "",
        check: wordsOf(text)[5] ?? "",
      }),
    },
  ];

  const successFillsOf = (request: { readonly text: string }): Fills => {
    const { text } = request;
    const line = SUCCESS_LINE_FILLS.find(({ marker }) => marker.test(text));
    return line === undefined ? { path: text.slice(text.indexOf(" ") + 1) } : line.fills(text);
  };

  const UPGRADE_SUCCESS_LINES: readonly PrintedLine[] = SUCCESS_TEXT.trimEnd()
    .split("\n")
    .map((text): PrintedLine => ({
      label: "upgrade",
      text,
      fills: successFillsOf({ text }),
    }));

  const lines: readonly PrintedLine[] = [
    ...SAMPLES.flatMap(({ failure, fills }) =>
      linesOf({
        text: upgradeFailureOutcomeOf({ failure, placement: { repoRoot: REPO, path: PATH } }).text,
        fills: { ...BASE_FILLS, ...fills },
      }),
    ),
    ...UPGRADE_SUCCESS_LINES,
    ...linesOf({ text: ALREADY_ON_VERSION_TWO.text, fills: {} }),
  ];
  return { UPGRADE_LINES: lines, UPGRADE_SUCCESS_LINES };
})();

const { PRINTABLE_LINES, PRINTED_SECTION_ROLES, PRINTED_BLOCKS, RUNNER_FAILURE_SAMPLES } = (() => {
  type EveryKind<Union extends { readonly kind: string }> = {
    readonly [Kind in Union["kind"]]: Extract<Union, { readonly kind: Kind }>;
  };

  type SectionSamples = {
    readonly [Name in SectionName]: readonly Filled<CheckReport[Name][number]>[];
  };

  const LOOPS = {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-15"),
    clause: clauseIdOf("loops"),
  };
  const MECHANISM = "eslint" as const;
  const FILE = repoPathOf("src/basket.ts");
  const RULE_PAGE = "node_modules/@hailstails/hone/rules/CD-15/README.md";
  const CHECK_PAGE =
    "node_modules/@hailstails/hone/rules/typescript/symptoms/loop-keyword/loop-statement.md";
  const ADOPTION_GUIDE = "node_modules/@hailstails/hone/ADOPTING.md";

  const PROJECT_COMMAND =
    "node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop";

  const PRUNE_COMMAND =
    "node /work/shop/node_modules/@hailstails/hone/src/hone.js prune-debt --repo /work/shop --base-revision origin/main";

  const SHARED_FILLS: Fills = {
    clause: "CD-15#loops",
    mechanism: "eslint",
    file: "src/basket.ts",
    line: "15",
    column: "0",
    snippet: "const total = 0;\\nreturn total;",
    "rule page": RULE_PAGE,
    "check page": CHECK_PAGE,
    "adoption guide": ADOPTION_GUIDE,
    "project command": PROJECT_COMMAND,
    "prune command": PRUNE_COMMAND,
  };

  const EDITION_READING: ClauseEditionReading = {
    address: LOOPS,
    mechanism: MECHANISM,
    edition: editionOf("1"),
    latest: editionOf("2"),
  };

  const FINDING: Finding = {
    clause: LOOPS,
    mechanism: MECHANISM,
    file: FILE,
    anchor: { line: 15, column: 0 },
    snippet: "const total = 0;\nreturn total;",
  };

  const REMEDIED_FINDING: Filled<Finding> = {
    entry: {
      ...FINDING,
      remedy: {
        fix: "write the values out",
        page: "node_modules/@hailstails/hone/rules/typescript/symptoms/computed-value-in-a-test/test-body.md",
        section: "a-method-that-computes-a-value",
      },
    },
    fills: {
      fix: "write the values out",
      "fix page":
        "node_modules/@hailstails/hone/rules/typescript/symptoms/computed-value-in-a-test/test-body.md",
      section: "a-method-that-computes-a-value",
    },
  };

  const RECORDS: EveryKind<ExceptionRecord> = {
    "authorised-location": {
      kind: "authorised-location",
      clause: LOOPS,
      mechanism: MECHANISM,
      file: FILE,
      reason: "the adapter",
    },
    "file-carve-out": {
      kind: "file-carve-out",
      clause: LOOPS,
      mechanism: MECHANISM,
      file: FILE,
      reason: "debt",
      whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
    },
    "clause-wide-carve-out": {
      kind: "clause-wide-carve-out",
      clause: LOOPS,
      mechanism: MECHANISM,
      reason: "debt",
      whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
    },
  };

  const IMPORTED_RECORDS: Readonly<
    Record<
      (ExistingAuthorisationProvenance | InheritedDebtProvenance)["kind"],
      Filled<ExceptionRecord>
    >
  > = {
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
        provenance: {
          kind: "inherited-debt",
          source: "legacy/exceptions.json#3",
          decision: "kept",
        },
      },
      fills: { "record kind": "file-carve-out", source: "legacy/exceptions.json#3" },
    },
  };

  type AttributedInlineDisable = Extract<
    AttributedNativeException,
    { readonly kind: "inline-disable" }
  >;

  type AttributedScriptOption = Extract<
    AttributedNativeException,
    { readonly kind: "command-line-option" }
  >;

  const INLINE_DISABLES: Readonly<
    Record<AttributedInlineDisable["reach"], Filled<AttributedInlineDisable>>
  > = {
    "one-clause": {
      entry: {
        kind: "inline-disable",
        clause: LOOPS,
        mechanism: MECHANISM,
        file: FILE,
        line: 4,
        text: "// eslint-disable-next-line",
        reach: "one-clause",
      },
      fills: { line: "4", comment: "// eslint-disable-next-line" },
    },
    "every-selected-clause": {
      entry: {
        kind: "inline-disable",
        clause: LOOPS,
        mechanism: MECHANISM,
        file: FILE,
        line: 1,
        text: "/* eslint-disable */",
        reach: "every-selected-clause",
      },
      fills: { line: "1", comment: "/* eslint-disable */" },
    },
  };

  const SCRIPT_OPTION_INVOCATION = "TIMING=1 eslint -c eslint.config.mjs .";

  const SCRIPT_OPTION_WRAPPER = "env";

  const SCRIPT_OPTIONS: Readonly<
    Record<AttributedScriptOption["cause"]["kind"], Filled<AttributedScriptOption>>
  > = {
    "weakens-run": {
      entry: {
        kind: "command-line-option",
        clause: LOOPS,
        mechanism: MECHANISM,
        location: repoPathOf("package.json"),
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
        location: repoPathOf("package.json"),
        script: "lint",
        option: "-c eslint.config.mjs",
        cause: {
          kind: "after-another-command",
          command: "eslint",
          invocation: SCRIPT_OPTION_INVOCATION,
        },
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
        location: repoPathOf("package.json"),
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
        location: repoPathOf("package.json"),
        script: "lint",
        option: "eslint --ignore-pattern 'legacy/**",
        cause: { kind: "unreadable", command: "eslint" },
      },
      fills: {
        "package file": "package.json",
        script: "lint",
        option: "eslint --ignore-pattern 'legacy/**",
        command: "eslint",
      },
    },
  };

  const NATIVE_EXCEPTIONS: {
    readonly [Kind in AttributedNativeException["kind"]]: readonly Filled<
      Extract<AttributedNativeException, { readonly kind: Kind }>
    >[];
  } = {
    ignore: [
      { entry: { kind: "ignore", clause: LOOPS, mechanism: MECHANISM, file: FILE }, fills: {} },
    ],
    "config-override": [
      {
        entry: { kind: "config-override", clause: LOOPS, mechanism: MECHANISM, file: FILE },
        fills: {},
      },
    ],
    "suppression-entry": [
      {
        entry: {
          kind: "suppression-entry",
          clause: LOOPS,
          mechanism: MECHANISM,
          file: FILE,
          location: repoPathOf("eslint-suppressions.json"),
        },
        fills: { "suppressions file": "eslint-suppressions.json" },
      },
    ],
    "inline-disable": Object.values(INLINE_DISABLES),
    "inline-rule-config": [
      {
        entry: {
          kind: "inline-rule-config",
          clause: LOOPS,
          mechanism: MECHANISM,
          file: FILE,
          line: 1,
          text: "/* eslint no-x: off */",
        },
        fills: { line: "1", comment: "/* eslint no-x: off */" },
      },
    ],
    "command-line-option": Object.values(SCRIPT_OPTIONS),
  };

  const SINGLE_RECORDS_FILE = repoPathOf("discipline-exceptions.json");

  const SPLIT_RECORDS_FOLDER = repoPathOf("discipline-exceptions");

  const SPLIT_RECORDS_FILE = repoPathOf("discipline-exceptions/file-carve-outs/cd-15.json");

  const RECORD_PROBLEMS: {
    readonly [Kind in InvalidRecord["problem"]["kind"]]: Filled<
      Extract<InvalidRecord["problem"], { readonly kind: Kind }>
    >;
  } = {
    "clause-unparseable": {
      entry: { kind: "clause-unparseable", detail: "not a clause address" },
      fills: { detail: "not a clause address" },
    },
    "clause-not-selected": { entry: { kind: "clause-not-selected", clause: LOOPS }, fills: {} },
    "clause-not-adopted": { entry: { kind: "clause-not-adopted", clause: LOOPS }, fills: {} },
    "clause-not-run": { entry: { kind: "clause-not-run", clause: LOOPS }, fills: {} },
    "file-not-repo-path": {
      entry: { kind: "file-not-repo-path", file: "../outside.ts" },
      fills: { file: "../outside.ts" },
    },
    "why-chain-refused": {
      entry: { kind: "why-chain-refused", detail: "the chain stops at a symptom" },
      fills: { detail: "the chain stops at a symptom" },
    },
    "evidence-refused": {
      entry: { kind: "evidence-refused", detail: "no evidence" },
      fills: { detail: "no evidence" },
    },
    "import-unverified": {
      entry: { kind: "import-unverified", detail: "the source has no such entry" },
      fills: { detail: "the source has no such entry" },
    },
    "non-exemptible-clause": { entry: { kind: "non-exemptible-clause", clause: LOOPS }, fills: {} },
    duplicate: {
      entry: {
        kind: "duplicate",
        of: { layout: "single-file", file: SINGLE_RECORDS_FILE, index: 0 },
      },
      fills: { "earlier index": "0" },
    },
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
    "not-included": {
      kind: "mechanism-not-run",
      mechanism: MECHANISM,
      projection: "not-included",
      nestedConfigurations: [],
    },
  };

  const NESTED_UNRUN: Filled<Unmeasured> = {
    entry: {
      kind: "mechanism-not-run",
      mechanism: MECHANISM,
      projection: "not-included",
      nestedConfigurations: [repoPathOf("packages/legacy"), repoPathOf("packages/tools")],
    },
    fills: { folders: "packages/legacy, packages/tools" },
  };

  const GIT_FAILED_BASE = {
    state: "git-failed",
    revision: "origin/main",
    gitMessage: "fatal: bad revision",
  } as const;

  const baseSamplesOf = (request: {
    readonly kind: BaseDependentKind;
  }): Readonly<Record<BaseRevisionAvailability["state"], Filled<Unmeasured>>> => ({
    "not-given": { entry: { kind: request.kind, base: { state: "not-given" } }, fills: {} },
    "git-failed": {
      entry: { kind: request.kind, base: GIT_FAILED_BASE },
      fills: {
        revision: JSON.stringify(GIT_FAILED_BASE.revision),
        "git message": JSON.stringify(GIT_FAILED_BASE.gitMessage),
      },
    },
  });

  const UNMEASURED: Readonly<Record<Unmeasured["kind"], readonly Filled<Unmeasured>[]>> = {
    "forfeiture-unmeasured": Object.values(baseSamplesOf({ kind: "forfeiture-unmeasured" })),
    "import-unmeasured": Object.values(baseSamplesOf({ kind: "import-unmeasured" })),
    "legacy-chain-unmeasured": Object.values(baseSamplesOf({ kind: "legacy-chain-unmeasured" })),
    "mechanism-not-run": [
      ...Object.values(UNRUN_PROJECTIONS).map((entry) => ({ entry, fills: {} })),
      NESTED_UNRUN,
    ],
  };

  const UNSLICED_UNRUN: readonly Filled<Unmeasured>[] = [
    { entry: UNRUN_PROJECTIONS["not-included"], fills: {} },
    NESTED_UNRUN,
  ];

  const SLICE = repoPathOf("packages/web/disciplines.eslint.mjs");

  const PROJECTION_PROBLEMS: {
    readonly [Scope in ProjectionProblem["scope"]]: Readonly<
      Record<Extract<ProjectionProblem, { readonly scope: Scope }>["state"], ProjectionProblem>
    >;
  } = {
    projection: {
      "out-of-date": { scope: "projection", mechanism: MECHANISM, state: "out-of-date" },
    },
    slice: {
      "out-of-date": { scope: "slice", mechanism: MECHANISM, state: "out-of-date", slice: SLICE },
      missing: { scope: "slice", mechanism: MECHANISM, state: "missing", slice: SLICE },
      "not-applied": { scope: "slice", mechanism: MECHANISM, state: "not-applied", slice: SLICE },
      unconfigured: { scope: "slice", mechanism: MECHANISM, state: "unconfigured", slice: SLICE },
    },
  };

  const ONE_CARVE_OUT_ELSEWHERE: PartialAssessment = {
    concern: "forfeiture",
    assessedBy: "elsewhere",
    fileCarveOuts: 1,
  };

  const PARTIAL_ASSESSMENTS: {
    readonly [Concern in PartialAssessment["concern"]]: Readonly<
      Record<PartialAssessment["assessedBy"], readonly Filled<PartialAssessment>[]>
    >;
  } = {
    forfeiture: {
      elsewhere: [
        { entry: ONE_CARVE_OUT_ELSEWHERE, fills: {} },
        {
          entry: { concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: 37 },
          fills: { count: "37" },
        },
      ],
    },
  };

  const readingOf = (request: {
    readonly assessmentSection: AssessmentSection;
    readonly presence: FilePresence;
  }): ClauseReading => ({
    kind: "clause",
    clause: LOOPS,
    assessmentSection: request.assessmentSection,
    pages: [{ path: RULE_PAGE, presence: request.presence, section: "spirit" }],
  });

  const READINGS: Readonly<
    Record<AssessmentSection, Readonly<Record<FilePresence, ClauseReading>>>
  > = {
    present: {
      present: readingOf({ assessmentSection: "present", presence: "present" }),
      absent: readingOf({ assessmentSection: "present", presence: "absent" }),
    },
    "not-assessed": {
      present: readingOf({ assessmentSection: "not-assessed", presence: "present" }),
      absent: readingOf({ assessmentSection: "not-assessed", presence: "absent" }),
    },
    unread: {
      present: readingOf({ assessmentSection: "unread", presence: "present" }),
      absent: readingOf({ assessmentSection: "unread", presence: "absent" }),
    },
  };

  type CheckPageShape = "fix" | "whole-page" | "absent";

  const CHECK_PAGES: Readonly<Record<CheckPageShape, ClausePage>> = {
    fix: { path: CHECK_PAGE, presence: "present", section: "fix" },
    "whole-page": { path: CHECK_PAGE, presence: "present", section: "whole-page" },
    absent: { path: CHECK_PAGE, presence: "absent", section: "whole-page" },
  };

  const checkReadingOf = (request: {
    readonly assessmentSection: AssessmentSection;
    readonly shape: CheckPageShape;
  }): ClauseReading => ({
    kind: "clause",
    clause: LOOPS,
    assessmentSection: request.assessmentSection,
    pages: [CHECK_PAGES[request.shape]],
  });

  const CHECK_READINGS: Readonly<
    Record<AssessmentSection, Readonly<Record<CheckPageShape, ClauseReading>>>
  > = {
    present: {
      fix: checkReadingOf({ assessmentSection: "present", shape: "fix" }),
      "whole-page": checkReadingOf({ assessmentSection: "present", shape: "whole-page" }),
      absent: checkReadingOf({ assessmentSection: "present", shape: "absent" }),
    },
    "not-assessed": {
      fix: checkReadingOf({ assessmentSection: "not-assessed", shape: "fix" }),
      "whole-page": checkReadingOf({ assessmentSection: "not-assessed", shape: "whole-page" }),
      absent: checkReadingOf({ assessmentSection: "not-assessed", shape: "absent" }),
    },
    unread: {
      fix: checkReadingOf({ assessmentSection: "unread", shape: "fix" }),
      "whole-page": checkReadingOf({ assessmentSection: "unread", shape: "whole-page" }),
      absent: checkReadingOf({ assessmentSection: "unread", shape: "absent" }),
    },
  };

  const NOTES: Readonly<Record<AssessmentFileNote["state"], AssessmentFileNote>> = {
    "not-written": { kind: "assessment-file", state: "not-written", guide: ADOPTION_GUIDE },
    unreadable: { kind: "assessment-file", state: "unreadable", guide: ADOPTION_GUIDE },
  };

  const PAID_DEBT_NOTES: readonly Filled<PaidDebtNote>[] = [
    { entry: { kind: "paid-debt", fileCarveOuts: 1, projections: [] }, fills: {} },
    { entry: { kind: "paid-debt", fileCarveOuts: 3, projections: [] }, fills: { count: "3" } },
    { entry: { kind: "paid-debt", fileCarveOuts: 1, projections: [MECHANISM] }, fills: {} },
    {
      entry: { kind: "paid-debt", fileCarveOuts: 3, projections: [MECHANISM] },
      fills: { count: "3" },
    },
  ];

  const SLICE_FOLDER = "packages/web";

  const projectionFillsOf = (request: { readonly problem: ProjectionProblem }): Fills =>
    request.problem.scope === "slice" ? { slice: request.problem.slice, folder: SLICE_FOLDER } : {};

  const unfilled = <Entry>(entries: readonly Entry[]): readonly Filled<Entry>[] =>
    entries.map((entry) => ({ entry, fills: {} }));

  const SECTION_SAMPLES: SectionSamples = {
    excluded: [{ entry: repoPathOf("generated"), fills: { path: "generated" } }],
    notAdopted: unfilled([LOOPS]),
    notRun: unfilled([LOOPS]),
    editions: [{ entry: EDITION_READING, fills: { edition: "1", latest: "2" } }],
    findings: [...unfilled([FINDING]), REMEDIED_FINDING],
    exempted: [
      ...Object.values(RECORDS).map((record) => ({
        entry: { finding: FINDING, by: [record] },
        fills: { "record kind": record.kind },
      })),
      ...Object.values(IMPORTED_RECORDS).map((imported) => ({
        entry: { finding: FINDING, by: [imported.entry] },
        fills: imported.fills,
      })),
    ],
    uncovered: unfilled([LOOPS]),
    stale: unfilled(Object.values(RECORDS)),
    forfeited: unfilled([RECORDS["file-carve-out"]]),
    unrecorded: Object.values(NATIVE_EXCEPTIONS).flat(),
    doublyHeld: unfilled([{ clause: LOOPS, file: FILE, mechanism: MECHANISM }]),
    invalidRecords: [
      ...Object.values(RECORD_PROBLEMS).map((problem, index) => ({
        entry: {
          place: { layout: "single-file" as const, file: SINGLE_RECORDS_FILE, index },
          problem: problem.entry,
        },
        fills: { ...problem.fills, index: String(index) },
      })),
      ...Object.values(SPLIT_RECORD_PROBLEMS).map((problem, index) => ({
        entry: {
          place: { layout: "split" as const, file: SPLIT_RECORDS_FILE, index },
          problem: problem.entry,
        },
        fills: { ...problem.fills, index: String(index), "records file": SPLIT_RECORDS_FILE },
      })),
    ],
    unmeasured: Object.values(UNMEASURED).flat(),
    projectionProblems: Object.values(PROJECTION_PROBLEMS)
      .flatMap((byState) => Object.values(byState))
      .map((problem) => ({ entry: problem, fills: projectionFillsOf({ problem }) })),
    assessment: Object.values(PARTIAL_ASSESSMENTS).flatMap((byAssessor) =>
      Object.values(byAssessor).flat(),
    ),
    readFirst: [
      ...unfilled(Object.values(READINGS).flatMap((byPresence) => Object.values(byPresence))),
      ...unfilled(Object.values(CHECK_READINGS).flatMap((byShape) => Object.values(byShape))),
      ...PAID_DEBT_NOTES,
    ],
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

  const entriesOf = <Entry>(samples: readonly Filled<Entry>[]): readonly Entry[] =>
    samples.map((sample) => sample.entry);

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

  const sampleFills: EntryFills = ({ section, position }) => ({
    ...SHARED_FILLS,
    ...SECTION_SAMPLES[section][position]?.fills,
  });

  const sharedFills: EntryFills = () => SHARED_FILLS;

  const unslicedFills: EntryFills = ({ position }) => ({
    ...SHARED_FILLS,
    ...UNSLICED_UNRUN[position]?.fills,
  });

  const NOTED_REPORTS: readonly CheckReport[] = Object.values(NOTES).flatMap((note) => [
    { ...EMPTY_REPORT, findings: [FINDING], readFirst: [note, READINGS.unread.present] },
    { ...EMPTY_REPORT, findings: [FINDING], readFirst: [note, READINGS.unread.absent] },
    { ...EMPTY_REPORT, findings: [FINDING], readFirst: [note, CHECK_READINGS.unread.fix] },
  ]);

  const VERDICT_REPORTS: Readonly<
    Record<Verdict, Readonly<Record<"whole" | "partial", CheckReport>>>
  > = {
    pass: {
      whole: EMPTY_REPORT,
      partial: { ...EMPTY_REPORT, assessment: [ONE_CARVE_OUT_ELSEWHERE] },
    },
    fail: {
      whole: { ...EMPTY_REPORT, findings: [FINDING] },
      partial: { ...EMPTY_REPORT, findings: [FINDING], assessment: [ONE_CARVE_OUT_ELSEWHERE] },
    },
  };

  const EVERY_OUTPUT: readonly ReportOutput[] = REPORT_OUTPUTS;

  const SYMPTOM_PAGE = "node_modules/@hailstails/hone/rules/typescript/symptoms.md";

  const CHECKS_PAGE =
    "node_modules/@hailstails/hone/rules/typescript/symptoms/branch-in-a-test/test-body.md";

  const AUDIT = "walker" as const;

  const TEST_BODY_LOGIC = {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-27"),
    clause: clauseIdOf("test-body-logic"),
  };

  const TEST_FILE = repoPathOf("src/orders/charge-order.test.ts");

  const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

  const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

  const AT_A_BOUNDARY: Principle = {
    name: "external-behaviour-sits-at-a-boundary",
    title: "External behaviour sits at a boundary",
  };

  const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

  const PORTS_DECLARED_INSIDE: Rule = {
    name: "ports-declared-inside",
    title: "Ports declared inside",
    principle: AT_A_BOUNDARY,
    standing: "accepted",
  };

  const WRITTEN_OUT_ANSWERS: Rule = {
    name: "written-out-answers",
    title: "Written-out answers",
    principle: TESTS_ARE_OURS,
    standing: "accepted",
  };

  const DOER_OR_ORCHESTRATOR: Rule = {
    name: "doer-or-orchestrator",
    title: "Doer or orchestrator",
    principle: ONE_PLACE_DECIDES,
    standing: "accepted",
  };

  const STRAIGHT_THROUGH_TESTS: Rule = {
    name: "straight-through-tests",
    title: "Straight-through tests",
    principle: TESTS_ARE_OURS,
    standing: "accepted",
  };

  const HANDED_WHAT_IT_USES: Rule = {
    name: "handed-what-it-uses",
    title: "Handed what it uses",
    principle: ONE_PLACE_DECIDES,
    standing: "accepted",
  };

  const NEEDS_THE_CURRENT_TIME: Case = {
    name: "needs-the-current-time-a-random-value-a-new-id-or-an-outside-ordering",
    title: "Needs the current time, a random value, a new id or an outside ordering",
    standing: "accepted",
    owes: [{ kind: "principle", principle: AT_A_BOUNDARY }],
  };

  const DOES_ONE_JOB: Case = {
    name: "does-one-job",
    title: "Does one job",
    standing: "accepted",
    owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }],
  };

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
    reason: { text: '"the world reaches a unit through a port"', standing: "accepted" },
  };

  const ASSERT_TO_NARROW: Recipe = {
    name: "assert-to-narrow",
    title: "Assert to narrow",
    standing: "accepted",
    reason: { text: '"it narrows the type"', standing: "accepted" },
  };

  const ITEACH_OVER_TYPED_ROWS: Recipe = {
    name: "iteach-over-typed-rows",
    title: "it.each over typed rows",
    standing: "accepted",
    reason: { text: '"each row is a case"', standing: "accepted" },
  };

  const BOUNDARY_RECORD: RecordKind = {
    name: "boundary-record",
    title: "Boundary record",
    phrase: "a boundary record",
    todaysFormat: "authorised-location",
  };

  const DEBT: RecordKind = {
    name: "debt",
    title: "Debt",
    phrase: "debt",
    todaysFormat: "file-carve-out",
  };

  const DEVIATION: RecordKind = {
    name: "deviation",
    title: "Deviation",
    phrase: "a deviation",
    todaysFormat: "none-yet",
  };

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
    breachUsuallySits:
      "in the unit's output type, where optional or loose shapes force the test to branch",
    recipes: [ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
    correctUses: [],
  };

  const DOUBLE_WITH_A_BODY: Symptom = {
    name: "double-with-a-body",
    title: "Double with a body",
    seen: "A double that has a function body.",
    mayIndicate: [
      {
        case: USES_WHAT_A_COLLABORATOR_GIVES_BACK,
        points: [{ kind: "rule", rule: HANDED_WHAT_IT_USES }],
      },
    ],
    breachUsuallySits: "in a port too wide",
    recipes: [],
    correctUses: [
      {
        situation: "a fake, where a stub cannot do the test",
        kind: DEVIATION,
        at: "from Stub with vi.fn",
      },
    ],
  };

  const SYMPTOM_GUIDE: SymptomGuide = {
    guide: "catalogue",
    page: SYMPTOM_PAGE,
    catalogue: {
      principles: [NO_HIDDEN_EFFECTS, TESTS_ARE_OURS, AT_A_BOUNDARY, ONE_PLACE_DECIDES],
      rules: [
        PORTS_DECLARED_INSIDE,
        WRITTEN_OUT_ANSWERS,
        DOER_OR_ORCHESTRATOR,
        STRAIGHT_THROUGH_TESTS,
        HANDED_WHAT_IT_USES,
      ],
      cases: [
        NEEDS_THE_CURRENT_TIME,
        DOES_ONE_JOB,
        CHECKS_A_VALUE,
        USES_WHAT_A_COLLABORATOR_GIVES_BACK,
      ],
      recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
      recordKinds: [AUTHORISED_LOCATION, BOUNDARY_RECORD, DEBT, DEVIATION],
      alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
      engines: [],
      symptoms: [DATE_USED_DIRECTLY, BRANCH_IN_A_TEST, DOUBLE_WITH_A_BODY],
      clauses: [
        {
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-17"),
            clause: clauseIdOf("clock-sources"),
          },
          sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY },
        },
        {
          clause: TEST_BODY_LOGIC,
          sight: {
            kind: "symptom-by-form",
            forms: [
              { section: "branching-with-if", symptom: BRANCH_IN_A_TEST },
              {
                section: "logic-inside-a-function-the-test-passes-on",
                symptom: DOUBLE_WITH_A_BODY,
              },
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
        clause: {
          ruleSet: TOOL_RULE_SET,
          discipline: disciplineIdOf("CD-17"),
          clause: clauseIdOf("clock-sources"),
        },
        mechanism: AUDIT,
        file: repoPathOf("src/orders/charge-order.ts"),
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
        remedy: {
          fix: "write one test per case, or one it.each table",
          page: CHECKS_PAGE,
          section: "branching-with-if",
        },
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
        snippet: 'kindOf: () => "file"',
        remedy: {
          fix: "make it a vi.fn spy",
          page: CHECKS_PAGE,
          section: "logic-inside-a-function-the-test-passes-on",
        },
      },
      fills: {
        clause: "CD-27#test-body-logic",
        mechanism: "audit",
        file: "src/orders/charge-order.test.ts",
        line: "30",
        column: "4",
        snippet: 'kindOf: () => "file"',
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
      indications:
        "needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator",
      breach: "in the unit that should be passed the time, often a doer doing two jobs",
      recipe: "World values through a port",
      answers:
        "Correct use: a boundary record on the clock adapter (today: authorised-location). Known debt: debt (today: file-carve-out)",
      "symptom page": SYMPTOM_PAGE,
    },
    {
      symptom: "branch-in-a-test",
      title: "Branch in a test",
      indications:
        "checks a value that may be one of several outcomes → Straight-through tests, No hidden effects",
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
      answers:
        "A fake, where a stub cannot do the test: a deviation from Stub with vi.fn (no record format yet). Known debt: debt (today: file-carve-out)",
      "symptom page": SYMPTOM_PAGE,
    },
  ];

  const SYMPTOM_FILLS: Partial<Record<SectionName, readonly Fills[]>> = {
    findings: SYMPTOM_FINDINGS.map((sample) => sample.fills),
    readFirst: SYMPTOM_NOTE_FILLS,
  };

  const symptomFills: EntryFills = ({ section, position }) => ({
    ...SYMPTOM_FILLS[section]?.[position],
  });

  const SYMPTOM_CATALOGUE = "node_modules/@hailstails/hone/rules/typescript/symptoms.json";

  const UNREAD_CATALOGUES: readonly Filled<UnreadableGuide>[] = [
    {
      entry: { guide: "unreadable", failure: `file-unreadable ${SYMPTOM_CATALOGUE} EACCES` },
      fills: { path: SYMPTOM_CATALOGUE, detail: "EACCES" },
    },
    {
      entry: { guide: "unreadable", failure: `file-malformed ${SYMPTOM_CATALOGUE} Unexpected end` },
      fills: { path: SYMPTOM_CATALOGUE, detail: "Unexpected end" },
    },
    {
      entry: { guide: "unreadable", failure: `unsupported-version ${SYMPTOM_CATALOGUE} 2` },
      fills: { path: SYMPTOM_CATALOGUE, "version found": "2" },
    },
  ];

  const REPORT_LINES: readonly PrintedLine[] = [
    ...EVERY_OUTPUT.flatMap((output) =>
      reportLinesOf({
        report: EVERY_ENTRY,
        output,
        projectCommand: PROJECT_COMMAND,
        pruneCommand: PRUNE_COMMAND,
        entryFills: sampleFills,
        guide: NO_SYMPTOM_GUIDE,
      }),
    ),
    ...reportLinesOf({
      report: { ...EMPTY_REPORT, unmeasured: entriesOf(UNSLICED_UNRUN) },
      output: "full",
      projectCommand: PROJECT_COMMAND,
      pruneCommand: PRUNE_COMMAND,
      entryFills: unslicedFills,
      guide: NO_SYMPTOM_GUIDE,
    }),
    ...[
      ...NOTED_REPORTS,
      ...Object.values(VERDICT_REPORTS).flatMap((byPart) => Object.values(byPart)),
    ].flatMap((report) =>
      reportLinesOf({
        report,
        output: "full",
        projectCommand: PROJECT_COMMAND,
        pruneCommand: PRUNE_COMMAND,
        entryFills: sharedFills,
        guide: NO_SYMPTOM_GUIDE,
      }),
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

  const PEER = {
    packageName: "eslint",
    peer: "required",
    supported: "^9.0.0 || ^10.0.0",
    found: "8.57.0",
  } as const;

  const PEER_FILLS: Fills = {
    package: "eslint",
    "version found": "8.57.0",
    range: "^9.0.0 || ^10.0.0",
  };

  const RUNNER_FAILURES: {
    readonly [Kind in RunnerFailure["kind"]]: Filled<
      Extract<RunnerFailure, { readonly kind: Kind }>
    >;
  } = {
    "piece-invalid": {
      entry: {
        kind: "piece-invalid",
        pieceRoot: "node_modules/@hailstails/hone/mechanisms/eslint/CD-1",
        detail: "no module",
      },
      fills: {
        "piece folder": "node_modules/@hailstails/hone/mechanisms/eslint/CD-1",
        detail: "no module",
      },
    },
    "file-unreadable": {
      entry: { kind: "file-unreadable", file: FILE, detail: "EACCES" },
      fills: { detail: "EACCES" },
    },
    "file-unparseable": {
      entry: { kind: "file-unparseable", file: FILE, detail: "unexpected token" },
      fills: { detail: "unexpected token" },
    },
    "tool-failed": {
      entry: { kind: "tool-failed", detail: "eslint exited 2" },
      fills: { detail: "eslint exited 2" },
    },
    "plugin-conflict": {
      entry: { kind: "plugin-conflict", detail: "two copies of the plugin" },
      fills: { detail: "two copies of the plugin" },
    },
    "team-config-unloadable": {
      entry: { kind: "team-config-unloadable", detail: "eslint.config.mjs threw" },
      fills: { detail: "eslint.config.mjs threw" },
    },
    "runner-invalid-output": {
      entry: { kind: "runner-invalid-output", detail: "not an array" },
      fills: { detail: "not an array" },
    },
    "toolchain-unavailable": {
      entry: { kind: "toolchain-unavailable", peers: [PEER] },
      fills: PEER_FILLS,
    },
    "toolchain-shadowed": {
      entry: {
        kind: "toolchain-shadowed",
        packageName: "eslint",
        location: "node_modules/@hailstails/hone/node_modules/eslint",
        installRoot: "node_modules/@hailstails/hone",
      },
      fills: {
        package: "eslint",
        location: "node_modules/@hailstails/hone/node_modules/eslint",
        "install folder": "node_modules/@hailstails/hone",
      },
    },
  };

  const UNAVAILABLE_TOOLCHAINS: readonly Filled<RunnerFailure>[] = [
    {
      entry: { kind: "toolchain-unavailable", peers: [{ ...PEER, found: "not installed" }] },
      fills: PEER_FILLS,
    },
    {
      entry: {
        kind: "toolchain-unavailable",
        peers: [PEER, { ...PEER, packageName: "typescript-eslint" }],
      },
      fills: { ...PEER_FILLS, "other package": "typescript-eslint" },
    },
  ];

  const RUNNER_FAILURE_SAMPLES: readonly Filled<RunnerFailure>[] = [
    ...Object.values(RUNNER_FAILURES),
    ...UNAVAILABLE_TOOLCHAINS,
  ];

  const LOAD_FAILURES: {
    readonly [Kind in LoadFailure["kind"]]: Filled<Extract<LoadFailure, { readonly kind: Kind }>>;
  } = {
    "arguments-invalid": {
      entry: { kind: "arguments-invalid", detail: "--repo needs a value" },
      fills: { detail: "--repo needs a value" },
    },
    "install-root-unresolvable": {
      entry: {
        kind: "install-root-unresolvable",
        url: "https://example.invalid/tool.js",
        detail: "not a file URL",
      },
      fills: { url: "https://example.invalid/tool.js", detail: "not a file URL" },
    },
    "file-unreadable": {
      entry: { kind: "file-unreadable", path: "disciplines.json", detail: "EACCES" },
      fills: { path: "disciplines.json", detail: "EACCES" },
    },
    "file-malformed": {
      entry: {
        kind: "file-malformed",
        path: "disciplines.json",
        detail: "clauses is not an object",
      },
      fills: { path: "disciplines.json", detail: "clauses is not an object" },
    },
    "file-unwritable": {
      entry: { kind: "file-unwritable", path: "discipline-exceptions.json", detail: "EACCES" },
      fills: { path: "discipline-exceptions.json", detail: "EACCES" },
    },
    "why-chains-required": {
      entry: { kind: "why-chains-required", path: "disciplines.json" },
      fills: { path: "disciplines.json" },
    },
    "records-in-both-layouts": {
      entry: {
        kind: "records-in-both-layouts",
        path: "discipline-exceptions.json",
        folder: "discipline-exceptions",
      },
      fills: { path: "discipline-exceptions.json", "records folder": "discipline-exceptions" },
    },
    "records-unsplittable": {
      entry: {
        kind: "records-unsplittable",
        path: "discipline-exceptions.json",
        detail: 'exceptions[3] has the clause "CD-15 loops", which names no discipline',
      },
      fills: {
        path: "discipline-exceptions.json",
        detail: 'exceptions[3] has the clause "CD-15 loops", which names no discipline',
      },
    },
    "unsupported-version": {
      entry: { kind: "unsupported-version", path: "disciplines.json", found: 2 },
      fills: { path: "disciplines.json", "version found": "2" },
    },
    "reserved-rule-set-name": {
      entry: { kind: "reserved-rule-set-name", name: "hone" },
      fills: { "rule set": "hone" },
    },
    "rule-set-name-collision": {
      entry: { kind: "rule-set-name-collision", name: "team", other: "team-web" },
      fills: { "rule set": "team", "other rule set": "team-web" },
    },
    "duplicate-clause": {
      entry: {
        kind: "duplicate-clause",
        address: "CD-15#loops",
        prefixedAddress: "hone/CD-15#loops",
      },
      fills: { "clause with its rule set": "hone/CD-15#loops" },
    },
    "unknown-rule-set": {
      entry: { kind: "unknown-rule-set", name: "team" },
      fills: { "rule set": "team" },
    },
    "unknown-discipline": {
      entry: { kind: "unknown-discipline", address: "CD-99#loops" },
      fills: { clause: "CD-99#loops" },
    },
    "unknown-clause": {
      entry: { kind: "unknown-clause", address: "CD-15#whiles" },
      fills: { clause: "CD-15#whiles" },
    },
    "judgement-clause-selected": {
      entry: { kind: "judgement-clause-selected", address: "CD-3#names" },
      fills: { clause: "CD-3#names" },
    },
    "judgement-clause-listed": {
      entry: { kind: "judgement-clause-listed", address: "CD-3#names" },
      fills: { clause: "CD-3#names" },
    },
    "mechanism-not-allowed": {
      entry: { kind: "mechanism-not-allowed", address: "CD-15#loops", mechanism: MECHANISM },
      fills: {},
    },
    "runner-missing": { entry: { kind: "runner-missing", mechanism: MECHANISM }, fills: {} },
    "runner-invalid": {
      entry: { kind: "runner-invalid", mechanism: MECHANISM, detail: "no runner export" },
      fills: { detail: "no runner export" },
    },
    "piece-missing": {
      entry: { kind: "piece-missing", address: "CD-15#loops", mechanism: MECHANISM },
      fills: {},
    },
    "rule-set-invalid": {
      entry: {
        kind: "rule-set-invalid",
        path: "team/rules/TM-1/discipline.json",
        detail: "no clauses",
      },
      fills: { path: "team/rules/TM-1/discipline.json", detail: "no clauses" },
    },
    "git-failed": {
      entry: { kind: "git-failed", detail: "not a git repository" },
      fills: { detail: "not a git repository" },
    },
    "config-root-untracked": {
      entry: { kind: "config-root-untracked", root: repoPathOf("packages/gone") },
      fills: { "config root": "packages/gone" },
    },
    "selection-absent": { entry: { kind: "selection-absent", repo: "src" }, fills: { dir: "src" } },
    "unexpected-error": {
      entry: { kind: "unexpected-error", detail: "Cannot read properties of undefined" },
      fills: { detail: "Cannot read properties of undefined" },
    },
    "runner-failed": {
      entry: {
        kind: "runner-failed",
        mechanism: MECHANISM,
        failure: RUNNER_FAILURES["tool-failed"].entry,
      },
      fills: RUNNER_FAILURES["tool-failed"].fills,
    },
  };

  const ARGUMENT_PROBLEMS: {
    readonly [Kind in ArgumentProblem["kind"]]: Filled<
      Extract<ArgumentProblem, { readonly kind: Kind }>
    >;
  } = {
    "command-missing": { entry: { kind: "command-missing" }, fills: {} },
    "command-unknown": {
      entry: { kind: "command-unknown", given: "lint" },
      fills: { given: "lint" },
    },
    "flag-extra": {
      entry: { kind: "flag-extra", flag: "--version", given: "extra" },
      fills: { flag: "--version", given: "extra" },
    },
    "argument-unexpected": {
      entry: { kind: "argument-unexpected", subcommand: "check", given: "src" },
      fills: { command: "check", given: "src", option: "--repo", value: "<dir>" },
    },
    "option-unknown": {
      entry: { kind: "option-unknown", subcommand: "project", given: "--fix" },
      fills: { command: "project", given: "--fix" },
    },
    "option-joined": {
      entry: { kind: "option-joined", option: REPO_OPTION, given: "--repo=src" },
      fills: { option: "--repo", value: "<dir>", given: "--repo=src" },
    },
    "value-missing": {
      entry: { kind: "value-missing", option: REPO_OPTION },
      fills: { option: "--repo", value: "<dir>" },
    },
    "option-repeated": {
      entry: { kind: "option-repeated", option: FORFEITURE_OPTION },
      fills: { option: "--forfeiture" },
    },
    "option-required": {
      entry: { kind: "option-required", subcommand: "check", option: REPO_OPTION },
      fills: { command: "check" },
    },
    "choice-invalid": {
      entry: {
        kind: "choice-invalid",
        option: FORFEITURE_OPTION,
        choices: ["this-run", "elsewhere"],
        given: "later",
      },
      fills: { option: "--forfeiture", values: "this-run or elsewhere", given: "later" },
    },
    "option-removed": {
      entry: {
        kind: "option-removed",
        given: "--waived-clauses",
        instead: WAIVED_CLAUSES_REPLACEMENT,
      },
      fills: {},
    },
    "repo-unresolvable": {
      entry: { kind: "repo-unresolvable", given: "src" },
      fills: { dir: "src" },
    },
    "path-invalid": {
      entry: { kind: "path-invalid", option: LEAVE_OPTION, given: "src/*.ts" },
      fills: { option: "--leave", given: "src/*.ts" },
    },
  };

  const failureLine = (request: {
    readonly label: string;
    readonly failure: LoadFailure;
    readonly fills: Fills;
  }): PrintedLine => ({
    label: request.label,
    text: loadFailureText(request).trimEnd(),
    fills: { ...SHARED_FILLS, ...request.fills },
  });

  const FAILURE_LINES: readonly PrintedLine[] = [
    ...Object.values(LOAD_FAILURES).map((sample) =>
      failureLine({ label: sample.entry.kind, failure: sample.entry, fills: sample.fills }),
    ),
    ...[...Object.values(RUNNER_FAILURES), ...UNAVAILABLE_TOOLCHAINS].map((sample) =>
      failureLine({
        label: "runner-failed",
        failure: { kind: "runner-failed", mechanism: MECHANISM, failure: sample.entry },
        fills: sample.fills,
      }),
    ),
    ...Object.values(ARGUMENT_PROBLEMS).map((sample) =>
      failureLine({
        label: sample.entry.kind,
        failure: argumentsInvalid({ problem: sample.entry }).error,
        fills: sample.fills,
      }),
    ),
  ];

  const PROJECTION_EFFECTS: Readonly<Record<ProjectionWrite["effect"], ProjectionWrite>> = {
    written: { path: repoPathOf("disciplines.eslint.mjs"), effect: "written" },
    unchanged: { path: repoPathOf("disciplines.eslint.mjs"), effect: "unchanged" },
    removed: { path: repoPathOf("disciplines.eslint.mjs"), effect: "removed" },
    "left-in-place": { path: repoPathOf("disciplines.eslint.mjs"), effect: "left-in-place" },
  };

  const linesOf = (request: {
    readonly label: string;
    readonly text: string;
    readonly fills: Fills;
  }): readonly PrintedLine[] =>
    request.text
      .trimEnd()
      .split("\n")
      .map((text) => ({ label: request.label, text, fills: request.fills }));

  const PROJECT_LINES: readonly PrintedLine[] = linesOf({
    label: "project",
    text: projectCommandOutcome({
      result: { outcome: "ok", value: Object.values(PROJECTION_EFFECTS) },
    }).text,
    fills: { path: "disciplines.eslint.mjs" },
  });

  const LEFT_UNDER = repoPathOf("src");

  const OWN_DISCIPLINES_FOLDER = repoPathOf("packages/legacy");

  const OWN_CONFIGURATION_FOLDER = repoPathOf("packages/legacy/tools");

  const INHERITED_DEBT_EFFECTS: Readonly<
    Record<InheritedDebtOutcome["effect"], InheritedDebtOutcome>
  > = {
    recorded: { clause: LOOPS, file: FILE, effect: "recorded" },
    "already-recorded": {
      clause: LOOPS,
      file: FILE,
      effect: "already-recorded",
      heldIn: SPLIT_RECORDS_FILE,
    },
    left: { clause: LOOPS, file: FILE, effect: "left", under: LEFT_UNDER },
    "new-file": { clause: LOOPS, file: FILE, effect: "new-file" },
    refused: { clause: LOOPS, file: FILE, effect: "refused" },
    "nested-configuration": {
      clause: LOOPS,
      file: FILE,
      effect: "nested-configuration",
      under: OWN_CONFIGURATION_FOLDER,
      selectionFolder: OWN_DISCIPLINES_FOLDER,
      mechanism: MECHANISM,
    },
  };

  const RECORD_DEBT_LINES: readonly PrintedLine[] = linesOf({
    label: "record-debt",
    text: recordDebtCommandOutcome({
      result: { outcome: "ok", value: Object.values(INHERITED_DEBT_EFFECTS) },
    }).text,
    fills: {
      clause: "CD-15#loops",
      file: "src/basket.ts",
      path: "src",
      "records file": SPLIT_RECORDS_FILE,
      folder: OWN_DISCIPLINES_FOLDER,
      "config folder": OWN_CONFIGURATION_FOLDER,
      mechanism: MECHANISM,
    },
  });

  const PRUNE_DEBT_LINES: readonly PrintedLine[] = linesOf({
    label: "prune-debt",
    text: pruneDebtCommandOutcome({
      result: { outcome: "ok", value: [{ clause: LOOPS, file: FILE }] },
    }).text,
    fills: { clause: "CD-15#loops", file: "src/basket.ts" },
  });

  const SPLIT_RECORDS_OUTCOMES: readonly { readonly split: RecordsSplit; readonly path: string }[] =
    [
      {
        split: { effect: "split", writes: [{ path: SPLIT_RECORDS_FILE, effect: "written" }] },
        path: SPLIT_RECORDS_FILE,
      },
      {
        split: { effect: "split", writes: [{ path: SINGLE_RECORDS_FILE, effect: "removed" }] },
        path: SINGLE_RECORDS_FILE,
      },
      {
        split: { effect: "already-split", path: SPLIT_RECORDS_FOLDER },
        path: SPLIT_RECORDS_FOLDER,
      },
      { split: { effect: "no-records", path: SINGLE_RECORDS_FILE }, path: SINGLE_RECORDS_FILE },
    ];

  const SPLIT_RECORDS_LINES: readonly PrintedLine[] = SPLIT_RECORDS_OUTCOMES.flatMap(
    ({ split, path }) =>
      linesOf({
        label: "split-records",
        text: splitRecordsCommandOutcome({ result: { outcome: "ok", value: split } }).text,
        fills: { path },
      }),
  );

  const VERSION_MANIFEST: FileTextPort = {
    read: () => ({
      outcome: "ok",
      value: JSON.stringify({ name: "@hailstails/hone", version: "1.0.0" }),
    }),
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

  const PRINTABLE_LINES: readonly PrintedLine[] = [
    ...REPORT_LINES,
    ...FAILURE_LINES,
    ...PROJECT_LINES,
    ...RECORD_DEBT_LINES,
    ...PRUNE_DEBT_LINES,
    ...SPLIT_RECORDS_LINES,
    ...UPGRADE_LINES,
    ...VERSION_LINES,
  ];

  const PRINTED_SECTION_ROLES: readonly DocumentedRole[] = SECTION_NAMES.map((section) => ({
    section,
    role: sectionRoleOf({ section }),
  }));

  const HELP_TOPICS: readonly HelpTopic[] = ["tool", ...SUBCOMMANDS];

  const FENCE = "```";

  const PRINTED_BLOCKS: readonly string[] = [
    SYNOPSIS,
    ...HELP_TOPICS.map((topic) => helpText({ topic })),
  ].map((text) => `${FENCE}text\n${text}${FENCE}`);

  return { PRINTABLE_LINES, PRINTED_SECTION_ROLES, PRINTED_BLOCKS, RUNNER_FAILURE_SAMPLES };
})();

const { RUN_PRINTABLE_LINES, RUN_SECTION_ROLES } = (() => {
  type SectionSamples = {
    readonly [Section in RunSectionName]: readonly Filled<RunReport[Section][number]>[];
  };

  const PROJECT_COMMAND =
    "node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop";

  const ORDER_FILE = repoPathOf("src/orders/charge-order.ts");

  const TEST_FILE = repoPathOf("src/orders/charge-order.test.ts");

  const WEBHOOK_FILE = repoPathOf("src/adapters/stripe-webhook.ts");

  const PACKAGE_FILE = repoPathOf("package.json");

  const DEBT_FILE = repoPathOf("hone-records/debt/claimed-type.json");

  const AUTHORISED_FILE = repoPathOf("hone-records/authorised-locations/claimed-type.json");

  const DEVIATIONS_FILE = repoPathOf("hone-records/deviations/world-values-through-a-port.json");

  const BOUNDARIES_FILE = repoPathOf("hone-records/boundary-records.json");

  const DEPENDENCIES_FILE = repoPathOf("hone-records/dependency-records.json");

  const SLICE = repoPathOf("packages/web/hone.eslint.mjs");

  const PRUNE_COMMAND =
    "node /work/shop/node_modules/@hailstails/hone/src/hone.js prune-debt --repo /work/shop";

  const SHARED_FILLS: Fills = {
    "project command": PROJECT_COMMAND,
    "prune command": PRUNE_COMMAND,
    "symptom page": SYMPTOM_PAGE,
  };

  const WEBHOOK_FILLS: Fills = { symptom: "claimed-type", file: "src/adapters/stripe-webhook.ts" };

  const STATED_DEBT: Debt = {
    kind: "debt",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: WEBHOOK_FILE,
    holding: { held: "stated" },
  };

  const CARRIED_DEBT: Debt = {
    kind: "debt",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: WEBHOOK_FILE,
    holding: { held: "carried", entry: {}, lacks: [], standing: "established" },
  };

  const MATCHED_LOCATION: AuthorisedLocation = {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: WEBHOOK_FILE,
    holding: {
      held: "stated",
      owing: {
        matches: "the-catalogue",
        case: GIVES_A_VALUE_ITS_TYPE,
        owes: OWED_DECLARED_NOT_ASSERTED,
      },
      whyChain: CAUSAL_WHY_CHAIN,
    },
  };

  const CARRIED_LOCATION: AuthorisedLocation = {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: WEBHOOK_FILE,
    holding: {
      held: "carried",
      entry: {},
      lacks: ["case", "owes", "whyChain"],
      standing: "unjudged",
    },
  };

  const UNKNOWN_CASE_LOCATION: AuthorisedLocation = {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: WEBHOOK_FILE,
    holding: {
      held: "stated",
      owing: {
        matches: "not-the-catalogue",
        note: { kind: "unknown-case", case: "parses a webhook", owes: "declared-not-asserted" },
      },
      whyChain: CAUSAL_WHY_CHAIN,
    },
  };

  const UNOWED_LOCATION: AuthorisedLocation = {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    reach: WHOLE_SYMPTOM,
    file: WEBHOOK_FILE,
    holding: {
      held: "stated",
      owing: {
        matches: "not-the-catalogue",
        note: { kind: "owes-not-owed", case: GIVES_A_VALUE_ITS_TYPE, owes: "written-out-answers" },
      },
      whyChain: CAUSAL_WHY_CHAIN,
    },
  };

  const DEVIATION: Deviation = {
    kind: "deviation",
    recipe: WORLD_VALUES_THROUGH_A_PORT,
    file: WEBHOOK_FILE,
    reasonFails: "Fails.",
    evidence: "Evidence.",
    ruleHolds: "Holds.",
  };

  const CLOCK_BOUNDARY: BoundaryRecord = {
    kind: "boundary-record",
    module: repoPathOf("src/adapters/system-clock.ts"),
    outsideParty: { kind: "runtime", facility: "clock" },
    holding: { held: "stated", ports: ["Clock"] },
  };

  const FILES_BOUNDARY: BoundaryRecord = {
    kind: "boundary-record",
    module: repoPathOf("src/adapters/files"),
    outsideParty: { kind: "scheme-module", specifier: "node:fs" },
    holding: { held: "carried", entry: {}, lacks: ["ports"], standing: "established" },
  };

  const DEPENDENCY: DependencyRecord = {
    kind: "dependency-record",
    dependency: "zod",
    nativeWay: "hand-written parsing",
    whyNotEnough: "Not enough.",
  };

  const CAST_REACH: SymptomReach = { reaches: "one-check", check: CAST_CHECK };

  const UNKNOWN_CHECK_REACH: AuthorisedReach = { reaches: "unknown-check", check: "cast-old" };

  const CAST_FILLS: Fills = {
    check: "claimed-type#cast-expressions",
    file: "src/adapters/stripe-webhook.ts",
  };

  const UNKNOWN_CHECK_FILLS: Fills = {
    ...WEBHOOK_FILLS,
    "check name": "cast-old",
    given: '"cast-old"',
  };

  const UNKNOWN_CASE_WORDS: Fills = { case: '"parses a webhook"', owes: '"declared-not-asserted"' };

  const UNOWED_WORDS: Fills = {
    "case name": "gives-a-value-its-type",
    owes: '"written-out-answers"',
  };

  type RecordSamples = {
    readonly [Kind in HoneRecord["kind"]]: readonly Filled<
      Extract<HoneRecord, { readonly kind: Kind }>
    >[];
  };

  const NOTED_LOCATIONS: { readonly [Kind in CatalogueNote["kind"]]: Filled<AuthorisedLocation> } =
    {
      "unknown-check": {
        entry: { ...MATCHED_LOCATION, reach: UNKNOWN_CHECK_REACH },
        fills: UNKNOWN_CHECK_FILLS,
      },
      "unknown-case": {
        entry: UNKNOWN_CASE_LOCATION,
        fills: { ...WEBHOOK_FILLS, ...UNKNOWN_CASE_WORDS },
      },
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
      {
        entry: { ...UNKNOWN_CASE_LOCATION, reach: CAST_REACH },
        fills: { ...CAST_FILLS, ...UNKNOWN_CASE_WORDS },
      },
      {
        entry: { ...UNOWED_LOCATION, reach: CAST_REACH },
        fills: { ...CAST_FILLS, ...UNOWED_WORDS },
      },
      {
        entry: { ...UNKNOWN_CASE_LOCATION, reach: UNKNOWN_CHECK_REACH },
        fills: { ...UNKNOWN_CHECK_FILLS, ...UNKNOWN_CASE_WORDS },
      },
      {
        entry: { ...UNOWED_LOCATION, reach: UNKNOWN_CHECK_REACH },
        fills: { ...UNKNOWN_CHECK_FILLS, ...UNOWED_WORDS },
      },
    ],
    deviation: [
      {
        entry: DEVIATION,
        fills: { recipe: "world-values-through-a-port", file: "src/adapters/stripe-webhook.ts" },
      },
    ],
    "boundary-record": [
      {
        entry: CLOCK_BOUNDARY,
        fills: { "outside party": "runtime:clock", module: "src/adapters/system-clock.ts" },
      },
      {
        entry: FILES_BOUNDARY,
        fills: { "outside party": "node:fs", module: "src/adapters/files" },
      },
    ],
    "dependency-record": [{ entry: DEPENDENCY, fills: { dependency: "zod" } }],
  };

  const RECORDS: readonly Filled<HoneRecord>[] = Object.values(RECORD_SAMPLES).flat();

  const RECORD_PART_LINES: readonly PrintedLine[] = RECORDS.flatMap(({ entry, fills }) => [
    { label: "subject", text: recordSubjectText({ record: entry }), fills },
    { label: "reference", text: recordReferenceText({ record: entry }), fills },
  ]);

  const DEBT_PLACED: PlacedRecord = { place: { file: DEBT_FILE, index: 0 }, record: STATED_DEBT };

  const LOCATION_PLACED: PlacedRecord = {
    place: { file: AUTHORISED_FILE, index: 0 },
    record: UNOWED_LOCATION,
  };

  const LOCATION_SUBJECT =
    'claimed-type authorised-location src/adapters/stripe-webhook.ts note: gives-a-value-its-type does not owe "written-out-answers"';

  const DEBT_SUBJECT = "claimed-type debt src/adapters/stripe-webhook.ts";

  const UNOWED_REFERENCE =
    'authorised-location note: gives-a-value-its-type does not owe "written-out-answers"';

  const CLOCK_FILLS: Fills = {
    check: "date-used-directly#clock-sources",
    engine: "walker",
    file: "src/orders/charge-order.ts",
    line: "14",
    column: "0",
    snippet: "const chargedAt = clock.now();",
    indicated: "ports-declared-inside, written-out-answers, doer-or-orchestrator",
  };

  const REMEDY = {
    fix: "write one test per case, or one it.each table",
    page: CHECKS_PAGE,
    section: "branching-with-if",
  };

  const REMEDY_FILLS: Fills = {
    fix: "write one test per case, or one it.each table",
    "fix page": CHECKS_PAGE,
    section: "branching-with-if",
  };

  const TEAM_FILLS: Fills = {
    check: "acme/AC-1#no-moment",
    engine: "eslint",
    file: "src/orders/charge-order.ts",
    line: "3",
    column: "6",
    snippet: "moment()",
  };

  const CAST_SITE_FILLS: Fills = { check: "claimed-type#cast-expressions", engine: "eslint" };

  const WEBHOOK_SITE_FILLS: Fills = { ...CAST_SITE_FILLS, file: "src/adapters/stripe-webhook.ts" };

  const SCRIPT_FILLS: Fills = {
    ...CAST_SITE_FILLS,
    "package file": "package.json",
    script: "lint",
  };

  type RefusedSample<Kind extends RecordRefusal["kind"]> = Filled<{
    readonly place: RecordPlace;
    readonly refusals: readonly [Extract<RecordRefusal, { readonly kind: Kind }>];
  }>;

  const REFUSALS: { readonly [Kind in RecordRefusal["kind"]]: RefusedSample<Kind> } = {
    "form-refused": {
      entry: {
        place: { file: AUTHORISED_FILE, index: 2 },
        refusals: [
          {
            kind: "form-refused",
            issues: [
              { path: ["file"], message: "Invalid input: expected string, received number" },
            ],
          },
        ],
      },
      fills: {
        "records file": "hone-records/authorised-locations/claimed-type.json",
        index: "2",
        issues: "file: Invalid input: expected string, received number",
      },
    },
    "unknown-symptom": {
      entry: {
        place: { file: DEBT_FILE, index: 1 },
        refusals: [{ kind: "unknown-symptom", symptom: "claimed type" }],
      },
      fills: {
        "records file": "hone-records/debt/claimed-type.json",
        index: "1",
        given: '"claimed type"',
      },
    },
    "unknown-check": {
      entry: {
        place: { file: DEBT_FILE, index: 5 },
        refusals: [{ kind: "unknown-check", symptom: "claimed-type", check: "cast-old" }],
      },
      fills: {
        "records file": "hone-records/debt/claimed-type.json",
        index: "5",
        given: '"cast-old"',
        symptom: "claimed-type",
      },
    },
    "unknown-recipe": {
      entry: {
        place: { file: DEVIATIONS_FILE, index: 0 },
        refusals: [{ kind: "unknown-recipe", recipe: "stub-with-vi-fn" }],
      },
      fills: {
        "records file": "hone-records/deviations/world-values-through-a-port.json",
        index: "0",
        given: '"stub-with-vi-fn"',
      },
    },
    "recipe-reason-not-the-catalogues": {
      entry: {
        place: { file: DEVIATIONS_FILE, index: 1 },
        refusals: [
          {
            kind: "recipe-reason-not-the-catalogues",
            recipe: WORLD_VALUES_THROUGH_A_PORT,
            recipeReason: "ports",
          },
        ],
      },
      fills: {
        "records file": "hone-records/deviations/world-values-through-a-port.json",
        index: "1",
        recipe: "world-values-through-a-port",
        reason: '"the world reaches a unit through a port"',
      },
    },
    "named-ban": {
      entry: {
        place: { file: DEPENDENCIES_FILE, index: 0 },
        refusals: [{ kind: "named-ban", dependency: "lodash" }],
      },
      fills: {
        "records file": "hone-records/dependency-records.json",
        index: "0",
        dependency: "lodash",
      },
    },
    "unknown-runtime-facility": {
      entry: {
        place: { file: BOUNDARIES_FILE, index: 3 },
        refusals: [{ kind: "unknown-runtime-facility", outsideParty: "runtime:env" }],
      },
      fills: {
        "records file": "hone-records/boundary-records.json",
        index: "3",
        "outside party": "runtime:env",
      },
    },
    misplaced: {
      entry: {
        place: { file: DEBT_FILE, index: 2 },
        refusals: [
          { kind: "misplaced", belongsIn: repoPathOf("hone-records/debt/date-used-directly.json") },
        ],
      },
      fills: {
        "records file": "hone-records/debt/claimed-type.json",
        index: "2",
        "belongs in": "hone-records/debt/date-used-directly.json",
      },
    },
    "not-a-records-name": {
      entry: {
        place: { file: DEBT_FILE, index: 3 },
        refusals: [{ kind: "not-a-records-name", name: "../x" }],
      },
      fills: { "records file": "hone-records/debt/claimed-type.json", index: "3", given: '"../x"' },
    },
    "carried-changed-since-base": {
      entry: {
        place: { file: AUTHORISED_FILE, index: 4 },
        refusals: [{ kind: "carried-changed-since-base" }],
      },
      fills: { "records file": "hone-records/authorised-locations/claimed-type.json", index: "4" },
    },
    duplicate: {
      entry: {
        place: { file: AUTHORISED_FILE, index: 5 },
        refusals: [{ kind: "duplicate", of: { file: AUTHORISED_FILE, index: 0 } }],
      },
      fills: {
        "records file": "hone-records/authorised-locations/claimed-type.json",
        index: "5",
        "earlier index": "0",
      },
    },
  };

  type SimpleNativeKind = Exclude<
    AttributedNativeException["kind"],
    "inline-disable" | "command-line-option"
  >;

  const SIMPLE_NATIVES: {
    readonly [Kind in SimpleNativeKind]: Filled<
      Extract<AttributedNativeException, { readonly kind: Kind }>
    >;
  } = {
    ignore: {
      entry: { kind: "ignore", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, mechanism: ESLINT },
      fills: WEBHOOK_SITE_FILLS,
    },
    "config-override": {
      entry: {
        kind: "config-override",
        clause: CAST_EXPRESSIONS,
        file: WEBHOOK_FILE,
        mechanism: ESLINT,
      },
      fills: WEBHOOK_SITE_FILLS,
    },
    "suppression-entry": {
      entry: {
        kind: "suppression-entry",
        clause: CAST_EXPRESSIONS,
        file: WEBHOOK_FILE,
        location: repoPathOf("eslint-suppressions.json"),
        mechanism: ESLINT,
      },
      fills: { ...WEBHOOK_SITE_FILLS, "suppressions file": "eslint-suppressions.json" },
    },
    "inline-rule-config": {
      entry: {
        kind: "inline-rule-config",
        clause: CAST_EXPRESSIONS,
        file: WEBHOOK_FILE,
        line: 1,
        text: "/* eslint no-restricted-syntax: off */",
        mechanism: ESLINT,
      },
      fills: {
        ...WEBHOOK_SITE_FILLS,
        line: "1",
        comment: "/* eslint no-restricted-syntax: off */",
      },
    },
  };

  const INLINE_DISABLES: Readonly<Record<InlineReach, Filled<AttributedNativeException>>> = {
    "one-clause": {
      entry: {
        kind: "inline-disable",
        clause: CAST_EXPRESSIONS,
        file: WEBHOOK_FILE,
        line: 4,
        text: "// eslint-disable-next-line no-restricted-syntax",
        reach: "one-clause",
        mechanism: ESLINT,
      },
      fills: {
        ...WEBHOOK_SITE_FILLS,
        line: "4",
        comment: "// eslint-disable-next-line no-restricted-syntax",
      },
    },
    "every-selected-clause": {
      entry: {
        kind: "inline-disable",
        clause: CAST_EXPRESSIONS,
        file: WEBHOOK_FILE,
        line: 4,
        text: "// eslint-disable-next-line",
        reach: "every-selected-clause",
        mechanism: ESLINT,
      },
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
      entry: {
        kind: "names-no-check",
        ruleId: "hone/claimed-type#no-such-check",
        file: WEBHOOK_FILE,
        line: 6,
        text: "/* eslint-disable hone/claimed-type#no-such-check */",
      },
      fills: {
        ...WEBHOOK_FILLS,
        line: "6",
        "rule id": "hone/claimed-type#no-such-check",
        comment: "/* eslint-disable hone/claimed-type#no-such-check */",
      },
    },
  ];

  const SCRIPT_OPTIONS: Readonly<
    Record<ScriptOptionCause["kind"], Filled<AttributedNativeException>>
  > = {
    "weakens-run": {
      entry: {
        kind: "command-line-option",
        clause: CAST_EXPRESSIONS,
        location: PACKAGE_FILE,
        script: "lint",
        option: "--no-inline-config",
        cause: { kind: "weakens-run" },
        mechanism: ESLINT,
      },
      fills: { ...SCRIPT_FILLS, option: "--no-inline-config" },
    },
    "after-another-command": {
      entry: {
        kind: "command-line-option",
        clause: CAST_EXPRESSIONS,
        location: PACKAGE_FILE,
        script: "lint",
        option: "--rule x:off",
        cause: {
          kind: "after-another-command",
          command: "eslint",
          invocation: "eslint --rule x:off .",
        },
        mechanism: ESLINT,
      },
      fills: {
        ...SCRIPT_FILLS,
        option: "--rule x:off",
        command: "eslint",
        invocation: '"eslint --rule x:off ."',
      },
    },
    wrapped: {
      entry: {
        kind: "command-line-option",
        clause: CAST_EXPRESSIONS,
        location: PACKAGE_FILE,
        script: "lint",
        option: "--rule x:off",
        cause: { kind: "wrapped", command: "eslint", wrapper: "env" },
        mechanism: ESLINT,
      },
      fills: { ...SCRIPT_FILLS, option: "--rule x:off", command: "eslint", wrapper: '"env"' },
    },
    unreadable: {
      entry: {
        kind: "command-line-option",
        clause: CAST_EXPRESSIONS,
        location: PACKAGE_FILE,
        script: "lint",
        option: "eslint 'x",
        cause: { kind: "unreadable", command: "eslint" },
        mechanism: ESLINT,
      },
      fills: { ...SCRIPT_FILLS, option: "eslint 'x", command: "eslint" },
    },
  };

  const GIT_FAILED: BaseRevisionAvailability = {
    state: "git-failed",
    revision: "origin/main",
    gitMessage: "fatal: bad revision",
  };

  const GIT_FAILED_FILLS: Fills = {
    revision: '"origin/main"',
    "git message": '"fatal: bad revision"',
  };

  const BASE_STATES: Readonly<
    Record<BaseRevisionAvailability["state"], Filled<BaseRevisionAvailability>>
  > = {
    "not-given": { entry: { state: "not-given" }, fills: {} },
    "git-failed": { entry: GIT_FAILED, fills: GIT_FAILED_FILLS },
  };

  const RECORDS_UNMEASURED_KINDS: Readonly<
    Record<RecordsUnmeasured["kind"], RecordsUnmeasured["kind"]>
  > = {
    "forfeiture-unmeasured": "forfeiture-unmeasured",
    "import-unmeasured": "import-unmeasured",
  };

  const RECORDS_UNMEASURED: readonly Filled<RunUnmeasured>[] = Object.values(
    RECORDS_UNMEASURED_KINDS,
  ).flatMap((kind) =>
    Object.values(BASE_STATES).map((base) => ({
      entry: { kind, base: base.entry },
      fills: base.fills,
    })),
  );

  const ENGINES_NOT_RUN: Readonly<
    Record<EngineNotRun["projection"], readonly Filled<RunUnmeasured>[]>
  > = {
    missing: [
      {
        entry: { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "missing" },
        fills: { engine: "eslint" },
      },
    ],
    "measured-nothing": [
      {
        entry: { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "measured-nothing" },
        fills: { engine: "eslint" },
      },
    ],
    "not-included": [
      {
        entry: {
          kind: "engine-not-run",
          engine: ESLINT_ENGINE,
          projection: "not-included",
          nestedConfigurations: [],
        },
        fills: { engine: "eslint" },
      },
      {
        entry: {
          kind: "engine-not-run",
          engine: ESLINT_ENGINE,
          projection: "not-included",
          nestedConfigurations: [repoPathOf("packages/legacy")],
        },
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
    entry: {
      scope: "slice",
      engine: ESLINT_ENGINE,
      state: "missing",
      slice: repoPathOf("packages/web/hone.eslint.d.mts"),
    },
    fills: { engine: "eslint", slice: "packages/web/hone.eslint.d.mts", folder: "packages/web" },
  };

  const SLICE_PROBLEMS: Readonly<Record<SliceState, Filled<RunProjectionProblem>>> = {
    "out-of-date": sliceProblem({ state: "out-of-date" }),
    missing: sliceProblem({ state: "missing" }),
    unconfigured: sliceProblem({ state: "unconfigured" }),
  };

  const SPACED_RECORDS_FILE: Filled<RunReport["refused"][number]> = {
    entry: {
      place: { file: repoPathOf("hone-records/debt/claimed type.json"), index: 0 },
      refusals: [{ kind: "misplaced", belongsIn: DEBT_FILE }],
    },
    fills: {
      "records file": '"hone-records/debt/claimed type.json"',
      index: "0",
      "belongs in": "hone-records/debt/claimed-type.json",
    },
  };

  const RECORD_NOTES: { readonly [Kind in CatalogueNote["kind"]]: Filled<RecordNote> } = {
    "unknown-check": {
      entry: {
        place: { file: AUTHORISED_FILE, index: 7 },
        note: { kind: "unknown-check", symptom: CLAIMED_TYPE, check: "cast-old" },
      },
      fills: {
        "records file": "hone-records/authorised-locations/claimed-type.json",
        index: "7",
        given: '"cast-old"',
        symptom: "claimed-type",
      },
    },
    "unknown-case": {
      entry: {
        place: { file: AUTHORISED_FILE, index: 8 },
        note: { kind: "unknown-case", case: "parses a webhook", owes: "declared-not-asserted" },
      },
      fills: {
        "records file": "hone-records/authorised-locations/claimed-type.json",
        index: "8",
        case: '"parses a webhook"',
        owes: '"declared-not-asserted"',
      },
    },
    "owes-not-owed": {
      entry: {
        place: { file: AUTHORISED_FILE, index: 0 },
        note: { kind: "owes-not-owed", case: GIVES_A_VALUE_ITS_TYPE, owes: "written-out-answers" },
      },
      fills: {
        "records file": "hone-records/authorised-locations/claimed-type.json",
        index: "0",
        "case name": "gives-a-value-its-type",
        owes: '"written-out-answers"',
      },
    },
  };

  const CONVENTION_NOTES: Readonly<
    Record<ConventionKey, Filled<RunReport["settings-notes"][number]>>
  > = {
    generated: {
      entry: { kind: "declared-not-read", key: "generated" },
      fills: { convention: "generated" },
    },
    layers: {
      entry: { kind: "declared-not-read", key: "layers" },
      fills: { convention: "layers" },
    },
  };

  const SECTION_SAMPLES: SectionSamples = {
    excluded: [{ entry: repoPathOf("dist"), fills: { path: "dist" } }],
    "not-adopted": [{ entry: CAST_CHECK, fills: CAST_SITE_FILLS }],
    "not-run": [{ entry: TEST_BODY_CHECK, fills: { check: "branch-in-a-test#test-body" } }],
    editions: [
      {
        entry: {
          check: CLOCK_CHECK,
          engine: WALKER,
          edition: editionOf("1"),
          latest: editionOf("2"),
        },
        fills: { ...CLOCK_FILLS, edition: "1", latest: "2" },
      },
    ],
    findings: [
      {
        entry: {
          clause: CLOCK_SOURCES,
          mechanism: AUDIT,
          file: ORDER_FILE,
          anchor: { line: 14, column: 0 },
          snippet: "const chargedAt = clock.now();",
        },
        fills: CLOCK_FILLS,
      },
      {
        entry: {
          clause: TEST_BODY_LOGIC,
          mechanism: AUDIT,
          file: TEST_FILE,
          anchor: { line: 22, column: 2 },
          snippet: "if (result.ok) {",
          remedy: REMEDY,
        },
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
      {
        entry: {
          clause: TEAM_CLAUSE,
          mechanism: ESLINT,
          file: ORDER_FILE,
          anchor: { line: 3, column: 6 },
          snippet: "moment()",
        },
        fills: TEAM_FILLS,
      },
      {
        entry: {
          clause: TEAM_CLAUSE,
          mechanism: ESLINT,
          file: ORDER_FILE,
          anchor: { line: 3, column: 6 },
          snippet: "moment()",
          remedy: REMEDY,
        },
        fills: { ...TEAM_FILLS, ...REMEDY_FILLS },
      },
    ],
    answered: [
      {
        entry: {
          finding: {
            clause: CAST_EXPRESSIONS,
            mechanism: ESLINT,
            file: WEBHOOK_FILE,
            anchor: { line: 4, column: 9 },
            snippet: "body as Event",
          },
          by: [LOCATION_PLACED],
        },
        fills: {
          ...WEBHOOK_SITE_FILLS,
          line: "4",
          column: "9",
          snippet: "body as Event",
          reference: UNOWED_REFERENCE,
        },
      },
    ],
    available: [{ entry: CLOCK_CHECK, fills: CLOCK_FILLS }],
    stale: [
      {
        entry: { placed: LOCATION_PLACED, reason: "credited-nothing" },
        fills: { subject: LOCATION_SUBJECT },
      },
      {
        entry: { placed: LOCATION_PLACED, reason: "file-gone" },
        fills: { subject: LOCATION_SUBJECT },
      },
      {
        entry: { placed: LOCATION_PLACED, reason: "file-excluded" },
        fills: { subject: LOCATION_SUBJECT },
      },
      {
        entry: { placed: DEBT_PLACED, reason: "credited-nothing" },
        fills: { subject: DEBT_SUBJECT },
      },
      { entry: { placed: DEBT_PLACED, reason: "file-gone" }, fills: { subject: DEBT_SUBJECT } },
      { entry: { placed: DEBT_PLACED, reason: "file-excluded" }, fills: { subject: DEBT_SUBJECT } },
    ],
    forfeited: [{ entry: DEBT_PLACED, fills: { subject: DEBT_SUBJECT } }],
    unrecorded: [
      ...Object.values(SIMPLE_NATIVES),
      ...Object.values(INLINE_DISABLES),
      ...Object.values(SCRIPT_OPTIONS),
    ],
    misnamed: MISNAMED_RULE_IDS,
    paid: [
      {
        entry: { debt: DEBT_PLACED, answeredBy: [LOCATION_PLACED] },
        fills: { subject: DEBT_SUBJECT, reference: UNOWED_REFERENCE },
      },
    ],
    refused: [...Object.values(REFUSALS), SPACED_RECORDS_FILE],
    unmeasured: [...RECORDS_UNMEASURED, ...Object.values(ENGINES_NOT_RUN).flat()],
    "projection-problems": [
      {
        entry: { scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" },
        fills: { engine: "eslint" },
      },
      ...Object.values(SLICE_PROBLEMS),
      DECLARATION_SLICE_PROBLEM,
    ],
    assessment: [
      { entry: { concern: "forfeiture", assessedBy: "elsewhere", debts: 1 }, fills: {} },
      {
        entry: { concern: "forfeiture", assessedBy: "elsewhere", debts: 3 },
        fills: { count: "3" },
      },
      { entry: { concern: "carried-standing", assessedBy: "elsewhere", carried: 1 }, fills: {} },
      {
        entry: { concern: "carried-standing", assessedBy: "elsewhere", carried: 3 },
        fills: { count: "3" },
      },
    ],
    "settings-notes": Object.values(CONVENTION_NOTES),
    "record-notes": Object.values(RECORD_NOTES),
    carried: [
      {
        entry: {
          place: { file: AUTHORISED_FILE, index: 6 },
          lacks: ["case", "owes", "whyChain"],
          standing: "unjudged",
        },
        fills: {
          "records file": "hone-records/authorised-locations/claimed-type.json",
          index: "6",
          standing: "unjudged",
          lacks: "case, owes, whyChain",
        },
      },
      {
        entry: { place: { file: DEBT_FILE, index: 4 }, lacks: [], standing: "established" },
        fills: {
          "records file": "hone-records/debt/claimed-type.json",
          index: "4",
          standing: "established",
        },
      },
    ],
    symptoms: [
      {
        entry: DATE_USED_DIRECTLY,
        fills: {
          symptom: "date-used-directly",
          title: "Date used directly",
          indications:
            "needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator",
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
          indications:
            "checks a value that may be one of several outcomes → Straight-through tests, No hidden effects",
          breach:
            "in the unit's output type, where optional or loose shapes force the test to branch",
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

  const entriesOf = <Entry>(samples: readonly Filled<Entry>[]): readonly Entry[] =>
    samples.map((sample) => sample.entry);

  const EMPTY_REPORT: RunReport = {
    excluded: [],
    "not-adopted": [],
    "not-run": [],
    editions: [],
    findings: [],
    answered: [],
    available: [],
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
    available: entriesOf(SECTION_SAMPLES.available),
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

  const sampleFills: EntryFills<RunSectionName> = ({ section, position }) => ({
    ...SHARED_FILLS,
    ...SECTION_SAMPLES[section][position]?.fills,
  });

  const linesOfReport = (request: {
    readonly report: RunReport;
    readonly output: VersionTwoReportOutput;
  }): readonly PrintedLine[] =>
    sectionedLinesOf({
      text: renderRunReportText({
        report: request.report,
        output: request.output,
        catalogue: REPORT_CATALOGUE,
        symptomPage: SYMPTOM_PAGE,
        projectCommand: PROJECT_COMMAND,
        pruneCommand: PRUNE_COMMAND,
      }),
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

  const RUN_PRINTABLE_LINES: readonly PrintedLine[] = [
    ...VERSION_TWO_REPORT_OUTPUTS.flatMap((output) =>
      linesOfReport({ report: EVERY_ENTRY, output }),
    ),
    ...linesOfReport({ report: UNSLICED_REPORT, output: "full" }),
    ...VERDICT_REPORTS.flatMap((report) => linesOfReport({ report, output: "verdict-only" })),
    ...RECORD_PART_LINES,
  ];

  const RUN_SECTION_ROLES: readonly DocumentedRole[] = RUN_SECTION_NAMES.map((section) => ({
    section,
    role: runSectionRoleOf({ section }),
  }));

  return { RUN_PRINTABLE_LINES, RUN_SECTION_ROLES };
})();

const { RUN_FAILURE_LINES, RUN_PRINTED_BLOCKS } = (() => {
  type FailureSamples = {
    readonly [Kind in RunLoadFailure["kind"]]: readonly Filled<
      Extract<RunLoadFailure, { readonly kind: Kind }>
    >[];
  };

  const UPGRADE_COMMAND =
    "node /work/shop/node_modules/@hailstails/hone/src/hone.js upgrade --repo /work/shop";

  const CATALOGUE_PATH = "node_modules/@hailstails/hone/rules/typescript/symptoms.json";

  const DEBT_FILE = repoPathOf("hone-records/debt/claimed-type.json");

  const DEBT_FOLDER = repoPathOf("hone-records/debt");

  const STRAY_FILE = repoPathOf("hone-records/notes.md");

  const CAST_CHECK_ADDRESS = "claimed-type#cast-expressions";

  const ENGINE_FILLS: Fills = { engine: "eslint" };

  const DOCUMENT_REFUSED: RecordsDocumentRefusal = {
    kind: "document-refused",
    file: DEBT_FILE,
    issues: [{ path: ["records", 0, "file"], message: "expected a repository path" }],
  };

  const STRAY_REFUSED: RecordsDocumentRefusal = { kind: "not-a-records-file", file: STRAY_FILE };

  const ISSUES = "records.0.file: expected a repository path";

  const FAILURE_SAMPLES: FailureSamples = {
    "arguments-invalid": [
      {
        entry: { kind: "arguments-invalid", detail: "--repo needs a value" },
        fills: { detail: "--repo needs a value" },
      },
    ],
    "install-root-unresolvable": [
      {
        entry: {
          kind: "install-root-unresolvable",
          url: "https://example.invalid/tool.js",
          detail: "not a file URL",
        },
        fills: { url: "https://example.invalid/tool.js", detail: "not a file URL" },
      },
    ],
    "file-unreadable": [
      {
        entry: { kind: "file-unreadable", path: "hone.config.json", detail: "EACCES" },
        fills: { path: "hone.config.json", detail: "EACCES" },
      },
    ],
    "file-malformed": [
      {
        entry: {
          kind: "file-malformed",
          path: "hone.config.json",
          detail: "checks: expected an array",
        },
        fills: { path: "hone.config.json", detail: "checks: expected an array" },
      },
    ],
    "file-unwritable": [
      {
        entry: { kind: "file-unwritable", path: "hone.eslint.mjs", detail: "EACCES" },
        fills: { path: "hone.eslint.mjs", detail: "EACCES" },
      },
    ],
    "unsupported-version": [
      {
        entry: { kind: "unsupported-version", path: "rules/CD-1/discipline.json", found: 3 },
        fills: { path: "rules/CD-1/discipline.json", "version found": "3" },
      },
    ],
    "reserved-rule-set-name": [
      { entry: { kind: "reserved-rule-set-name", name: "hone" }, fills: { "rule set": "hone" } },
    ],
    "rule-set-name-collision": [
      {
        entry: { kind: "rule-set-name-collision", name: "team", other: "Team" },
        fills: { "rule set": "team", "other rule set": "Team" },
      },
    ],
    "unknown-rule-set": [
      { entry: { kind: "unknown-rule-set", name: "team" }, fills: { "rule set": "team" } },
    ],
    "rule-set-invalid": [
      {
        entry: { kind: "rule-set-invalid", path: "team/rules", detail: "no clauses" },
        fills: { path: "team/rules", detail: "no clauses" },
      },
    ],
    "git-failed": [
      {
        entry: { kind: "git-failed", detail: "not a git repository" },
        fills: { detail: "not a git repository" },
      },
    ],
    "config-root-untracked": [
      {
        entry: { kind: "config-root-untracked", root: repoPathOf("packages/gone") },
        fills: { "config root": "packages/gone" },
      },
    ],
    "unexpected-error": [
      { entry: { kind: "unexpected-error", detail: "boom" }, fills: { detail: "boom" } },
    ],
    "config-absent": [
      { entry: { kind: "config-absent", repo: "/work/shop" }, fills: { dir: "/work/shop" } },
    ],
    "settings-in-both-versions": [
      {
        entry: { kind: "settings-in-both-versions", repo: "/work/shop" },
        fills: { dir: "/work/shop" },
      },
    ],
    "not-ready-yet": [
      {
        entry: { kind: "not-ready-yet", what: { thing: "command", command: "record-debt" } },
        fills: { command: "record-debt" },
      },
      {
        entry: {
          kind: "not-ready-yet",
          what: { thing: "eslint-config-roots", paths: ["vendor/lib", "vendor/tool"] },
        },
        fills: { folders: "vendor/lib, vendor/tool" },
      },
    ],
    "unknown-check": [
      {
        entry: { kind: "unknown-check", check: "claimed-type#casts" },
        fills: { check: "claimed-type#casts" },
      },
      { entry: { kind: "unknown-check", check: "my check#x y" }, fills: { check: "my check#x y" } },
    ],
    "review-only-listed": [
      {
        entry: { kind: "review-only-listed", check: "names#names" },
        fills: { check: "names#names" },
      },
    ],
    "duplicate-check": [
      {
        entry: {
          kind: "duplicate-check",
          key: "checkSettings",
          check: CAST_CHECK_ADDRESS,
          prefixedCheck: "hone/claimed-type#cast-expressions",
        },
        fills: {
          "settings key": "checkSettings",
          check: CAST_CHECK_ADDRESS,
          "check with its rule set": "hone/claimed-type#cast-expressions",
        },
      },
    ],
    "engine-not-allowed": [
      {
        entry: {
          kind: "engine-not-allowed",
          check: CAST_CHECK_ADDRESS,
          engine: "walker",
          allowed: { stated: "by-catalogue", engines: ["eslint"] },
        },
        fills: { check: CAST_CHECK_ADDRESS, engine: "walker", engines: "eslint" },
      },
      {
        entry: {
          kind: "engine-not-allowed",
          check: CAST_CHECK_ADDRESS,
          engine: "walker",
          allowed: { stated: "by-catalogue", engines: ["eslint", "oxlint"] },
        },
        fills: { check: CAST_CHECK_ADDRESS, engine: "walker", engines: "eslint or oxlint" },
      },
      {
        entry: {
          kind: "engine-not-allowed",
          check: CAST_CHECK_ADDRESS,
          engine: "walker",
          allowed: { stated: "by-rule-set" },
        },
        fills: { check: CAST_CHECK_ADDRESS, engine: "walker" },
      },
    ],
    "engine-missing": [
      {
        entry: { kind: "engine-missing", engine: { named: "engine", engine: ESLINT_ENGINE } },
        fills: ENGINE_FILLS,
      },
      {
        entry: { kind: "engine-missing", engine: { named: "mechanism", mechanism: "eslint" } },
        fills: { engine: "eslint" },
      },
    ],
    "engine-invalid": [
      {
        entry: {
          kind: "engine-invalid",
          engine: { named: "engine", engine: WALKER },
          detail: "no runner export",
        },
        fills: { engine: "walker", detail: "no runner export" },
      },
    ],
    "engine-failed": RUNNER_FAILURE_SAMPLES.map((sample) => ({
      entry: {
        kind: "engine-failed",
        engine: { named: "engine", engine: ESLINT_ENGINE },
        failure: sample.entry,
      },
      fills: { file: "src/basket.ts", ...sample.fills, ...ENGINE_FILLS },
    })),
    "check-missing": [
      {
        entry: {
          kind: "check-missing",
          check: CAST_CHECK_ADDRESS,
          engine: { named: "engine", engine: ESLINT_ENGINE },
        },
        fills: { check: CAST_CHECK_ADDRESS, ...ENGINE_FILLS },
      },
    ],
    "checks-run-together": [
      {
        entry: {
          kind: "checks-run-together",
          check: "branch-in-a-test#conditionals",
          others: ["branch-in-a-test#loops", "branch-in-a-test#ternaries"],
        },
        fills: {
          check: "branch-in-a-test#conditionals",
          "other checks": "branch-in-a-test#loops branch-in-a-test#ternaries",
        },
      },
    ],
    "check-settings-refused": [
      {
        entry: { kind: "check-settings-refused", check: CAST_CHECK_ADDRESS, listing: "unlisted" },
        fills: { check: CAST_CHECK_ADDRESS },
      },
      {
        entry: { kind: "check-settings-refused", check: CAST_CHECK_ADDRESS, listing: "not-run" },
        fills: { check: CAST_CHECK_ADDRESS, state: "not-run" },
      },
      {
        entry: {
          kind: "check-settings-refused",
          check: CAST_CHECK_ADDRESS,
          listing: "not-adopted",
        },
        fills: { check: CAST_CHECK_ADDRESS, state: "not-adopted" },
      },
    ],
    "check-settings-differ": [
      {
        entry: {
          kind: "check-settings-differ",
          check: "branch-in-a-test#loops",
          other: "branch-in-a-test#conditionals",
        },
        fills: { check: "branch-in-a-test#loops", "other check": "branch-in-a-test#conditionals" },
      },
    ],
    "records-folder-unreadable": [
      {
        entry: { kind: "records-folder-unreadable", folder: DEBT_FOLDER, detail: "EACCES" },
        fills: { "records folder": "hone-records/debt", detail: "EACCES" },
      },
    ],
    "records-file-unreadable": [
      {
        entry: { kind: "records-file-unreadable", file: DEBT_FILE, detail: "EACCES" },
        fills: { "records file": "hone-records/debt/claimed-type.json", detail: "EACCES" },
      },
    ],
    "records-file-not-json": [
      {
        entry: {
          kind: "records-file-not-json",
          file: repoPathOf("hone-records/debt/claimed type.json"),
          detail: "Unexpected token",
        },
        fills: {
          "records file": '"hone-records/debt/claimed type.json"',
          detail: "Unexpected token",
        },
      },
    ],
    "not-a-records-file": [
      {
        entry: { kind: "not-a-records-file", file: STRAY_FILE },
        fills: { "records file": "hone-records/notes.md" },
      },
    ],
    "not-a-records-name": [
      {
        entry: { kind: "not-a-records-name", folder: DEBT_FOLDER, name: "a\\b.json" },
        fills: { "records folder": "hone-records/debt", name: '"a\\\\b.json"' },
      },
    ],
    "records-refused": [
      {
        entry: { kind: "records-refused", refusals: [DOCUMENT_REFUSED] },
        fills: { "records file": "hone-records/debt/claimed-type.json", "document issues": ISSUES },
      },
      {
        entry: { kind: "records-refused", refusals: [STRAY_REFUSED] },
        fills: { "records file": "hone-records/notes.md" },
      },
      {
        entry: { kind: "records-refused", refusals: [DOCUMENT_REFUSED, STRAY_REFUSED] },
        fills: {
          "records file": "hone-records/debt/claimed-type.json",
          "document issues": ISSUES,
          "other records file": "hone-records/notes.md",
        },
      },
    ],
    "catalogue-not-read": [
      {
        entry: { kind: "catalogue-not-read", path: CATALOGUE_PATH, reason: { reason: "absent" } },
        fills: { path: CATALOGUE_PATH },
      },
      {
        entry: {
          kind: "catalogue-not-read",
          path: CATALOGUE_PATH,
          reason: { reason: "unreadable", detail: "symptoms: expected an array" },
        },
        fills: { path: CATALOGUE_PATH, detail: "symptoms: expected an array" },
      },
    ],
    "upgrade-needed": [
      {
        entry: { kind: "upgrade-needed", path: "disciplines.json" },
        fills: { path: "disciplines.json", "upgrade command": UPGRADE_COMMAND },
      },
      {
        entry: { kind: "upgrade-needed", path: "disciplines.json" },
        fills: { path: "disciplines.json" },
      },
    ],
  };

  const failureLineOf = (request: { readonly sample: Filled<RunLoadFailure> }): PrintedLine => ({
    label: request.sample.entry.kind,
    text: runLoadFailureLine({
      failure: request.sample.entry,
      upgradeCommand: request.sample.fills["upgrade command"],
    }),
    fills: request.sample.fills,
  });

  const RUN_FAILURE_LINES: readonly PrintedLine[] = Object.values(FAILURE_SAMPLES)
    .flat()
    .map((sample) => failureLineOf({ sample }));

  const HELP_TOPICS: readonly RunHelpTopic[] = ["tool", ...RUN_SUBCOMMANDS];

  const FENCE = "```";

  const RUN_PRINTED_BLOCKS: readonly string[] = [
    RUN_SYNOPSIS,
    ...HELP_TOPICS.map((topic) => runHelpText({ topic })),
  ].map((text) => `${FENCE}text\n${text}${FENCE}`);

  return { RUN_FAILURE_LINES, RUN_PRINTED_BLOCKS };
})();

const RECORD_COMMAND_LINES: readonly PrintedLine[] = (() => {
  const FILE = repoPathOf("src/orders/charge-order.ts");

  const RECORDS_FILE = repoPathOf("hone-records/debt/date-used-directly.json");

  const ADDRESS = "date-used-directly#clock-sources";

  const SITE = { address: ADDRESS, file: FILE } as const;

  const LEFT_UNDER = repoPathOf("src/orders");

  const DEBT: Debt = {
    kind: "debt",
    symptom: DATE_USED_DIRECTLY,
    reach: WHOLE_SYMPTOM,
    file: FILE,
    holding: { held: "stated" },
  };

  const OUTCOMES: readonly (readonly [DebtOutcome, Readonly<Record<string, string>>])[] = [
    [{ ...SITE, effect: "recorded" }, {}],
    [
      { ...SITE, effect: "already-recorded", heldIn: RECORDS_FILE },
      { "records file": RECORDS_FILE },
    ],
    [{ ...SITE, effect: "left", under: LEFT_UNDER }, { path: LEFT_UNDER }],
    [{ ...SITE, effect: "touched", of: "finding" }, {}],
    [{ ...SITE, effect: "touched", of: "native-exception" }, {}],
    [
      {
        address: "CD-99#nowhere",
        file: FILE,
        effect: "unrecordable",
        because: { kind: "no-check" },
      },
      { clause: "CD-99#nowhere" },
    ],
    [{ ...SITE, effect: "unrecordable", because: { kind: "ignore" } }, {}],
    [{ ...SITE, effect: "unrecordable", because: { kind: "inline-rule-config" } }, {}],
    [{ ...SITE, effect: "unrecordable", because: { kind: "suppression-entry" } }, {}],
    [
      {
        ...SITE,
        effect: "unrecordable",
        because: { kind: "command-line-option", cause: { kind: "weakens-run" } },
      },
      {},
    ],
    [
      {
        ...SITE,
        effect: "unrecordable",
        because: {
          kind: "command-line-option",
          cause: {
            kind: "after-another-command",
            command: "eslint",
            invocation: "eslint --rule x:off .",
          },
        },
      },
      { command: "eslint", invocation: '"eslint --rule x:off ."' },
    ],
    [
      {
        ...SITE,
        effect: "unrecordable",
        because: {
          kind: "command-line-option",
          cause: { kind: "wrapped", command: "eslint", wrapper: "env" },
        },
      },
      { command: "eslint", wrapper: '"env"' },
    ],
    [
      {
        ...SITE,
        effect: "unrecordable",
        because: { kind: "command-line-option", cause: { kind: "unreadable", command: "eslint" } },
      },
      { command: "eslint" },
    ],
    [{ ...SITE, effect: "unrecordable", because: { kind: "config-override" } }, {}],
    [{ ...SITE, effect: "unrecordable", because: { kind: "inline-disable" } }, {}],
  ];

  const PRUNED_REASONS: readonly PrunedReason[] = [
    "paid",
    "credited-nothing",
    "file-gone",
    "file-excluded",
    "forfeited",
  ];

  const AUTHORISINGS: readonly (readonly [Authorising, Readonly<Record<string, string>>])[] = [
    [{ judged: "accepted", edit: { write: [], remove: [] } }, {}],
    [{ judged: "already-held", heldIn: RECORDS_FILE }, { "records file": RECORDS_FILE }],
  ];

  const REFUSALS: readonly (readonly [RecordRefusal, Readonly<Record<string, string>>])[] = [
    [{ kind: "unknown-symptom", symptom: "no-such-symptom" }, { given: "no-such-symptom" }],
    [{ kind: "not-a-records-name", name: "Not A Name" }, { given: "Not A Name" }],
  ];

  const ADDRESS_FILE = { address: ADDRESS, file: FILE };

  const MISTAKEN_CHAIN: AuthoriseRequest = {
    answers: "claimed-type",
    file: FILE,
    case: "gives-a-value-its-type",
    owes: "declared-not-asserted",
    whys: CAUSAL_WHY_CHAIN.whys,
    rootCause: "no",
    rootEvidence: CAUSAL_WHY_CHAIN.rootEvidence,
    readback: CAUSAL_WHY_CHAIN.readback,
    owner: CAUSAL_WHY_CHAIN.owner,
  };

  const formRefusalSample = (): readonly (readonly [
    RecordRefusal,
    Readonly<Record<string, string>>,
  ])[] => {
    const judged = authorisingOf({
      request: MISTAKEN_CHAIN,
      documents: [],
      catalogue: REPORT_CATALOGUE,
      recordsReader,
      recordsEditor,
    });
    if (judged.outcome === "failed" || judged.value.judged !== "refused") {
      return [];
    }
    return judged.value.refusals.flatMap((refusal) =>
      refusal.kind === "form-refused"
        ? refusal.issues.map(
            (issue): readonly [RecordRefusal, Readonly<Record<string, string>>] => [
              { kind: "form-refused", issues: [issue] },
              { path: issue.path.join("."), message: issue.message },
            ],
          )
        : [],
    );
  };

  const PROJECT_COMMAND =
    "node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop";

  return [
    ...OUTCOMES.map(([outcome, fills]): PrintedLine => ({
      label: "record-debt",
      text: debtOutcomeLine({ outcome }),
      fills: { file: FILE, address: ADDRESS, ...fills },
    })),
    {
      label: "record-debt",
      text: projectNextLine({ projectCommand: PROJECT_COMMAND }),
      fills: { "project command": PROJECT_COMMAND },
    },
    ...PRUNED_REASONS.map((reason): PrintedLine => ({
      label: "prune-debt",
      text: prunedDebtLine({
        pruned: { place: { file: RECORDS_FILE, index: 0 }, debt: DEBT, reason },
      }),
      fills: { address: "date-used-directly", file: FILE },
    })),
    ...AUTHORISINGS.flatMap(([authorising, fills]) =>
      authorisingLines({ ...ADDRESS_FILE, authorising }).map((text): PrintedLine => ({
        label: "authorise",
        text,
        fills: { address: ADDRESS, file: FILE, ...fills },
      })),
    ),
    ...[...REFUSALS, ...formRefusalSample()].flatMap(([refusal, fills]) =>
      authorisingLines({
        ...ADDRESS_FILE,
        authorising: { judged: "refused", refusals: [refusal] },
      }).map((text): PrintedLine => ({
        label: "authorise",
        text,
        fills: { address: ADDRESS, file: FILE, ...fills },
      })),
    ),
  ];
})();

const REPO_FOLDER = "/repo";

const ENTRY_URL = "file:///install/src/hone.ts";

const SEPARATOR = "/";

const FENCE = "```";

const HELP_BLOCK = /```text\n(usage: [\s\S]*?)```/g;

const memoryFileTextOf = (request: {
  readonly files: Readonly<Record<string, string>>;
}): FileTextPort => {
  const held = new Map<string, string>(
    Object.entries(request.files).map(([file, text]) => [
      `${REPO_FOLDER}${SEPARATOR}${file}`,
      text,
    ]),
  );
  const keysUnder = (folder: string): readonly string[] =>
    [...held.keys()].filter((key) => key.startsWith(`${folder}${SEPARATOR}`));
  return {
    exists: ({ path }) => (held.has(path) || keysUnder(path).length > 0 ? "present" : "absent"),
    read: ({ path }) => {
      const text = held.get(path);
      return text === undefined
        ? { outcome: "failed", error: { kind: "unreadable", path, detail: "absent" } }
        : { outcome: "ok", value: text };
    },
    write: ({ path, text }) => {
      held.set(path, text);
      return { outcome: "ok", value: undefined };
    },
  };
};

type Writes = Parameters<ProcessPort["writeOut"]>[];

type Exits = Parameters<ProcessPort["exitWith"]>[];

type RecordedProcess = {
  readonly port: ProcessPort;
  readonly writes: Writes;
  readonly exits: Exits;
};

const recordedProcessWith = (request: {
  readonly arguments: readonly string[];
}): RecordedProcess => {
  const writes: Writes = [];
  const exits: Exits = [];
  return {
    port: {
      arguments: request.arguments,
      writeOut: (written) => writes.push([written]),
      writeError: () => undefined,
      exitWith: (exit) => exits.push([exit]),
    },
    writes,
    exits,
  };
};

const notUsed = (): never => {
  throw new Error("this port is not used by the command under test");
};

const commandOver = (request: {
  readonly process: ProcessPort;
  readonly fileText: FileTextPort;
}): VersionOneCommandRequest => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: request.fileText,
  engine: createDefaultEnginePort({}),
  modules: { load: notUsed },
  git: {
    trackedPaths: notUsed,
    changedSince: notUsed,
    contentInBase: notUsed,
    textInBase: notUsed,
    renamedSince: notUsed,
  },
  exceptionRepositoryOf: notUsed,
  exceptionEntryParser: {
    parseExceptionEntries: notUsed,
    importedEntriesIn: notUsed,
    importSourcesOf: notUsed,
  },
  selectionRepositoryOf: notUsed,
  shownPathOfRepository: notUsed,
  moduleUrl: ENTRY_URL,
});

const printedHelpBlockOf = async (request: {
  readonly given: readonly string[];
  readonly files: Readonly<Record<string, string>>;
}): Promise<string> => {
  const recorded = recordedProcessWith({ arguments: request.given });
  await commandRan(
    commandOver({ process: recorded.port, fileText: memoryFileTextOf({ files: request.files }) }),
  );
  return `${FENCE}text\n${recorded.writes.map(([written]) => written.text).join("")}${FENCE}`;
};

const printedHelpBlocksOf = async (request: {
  readonly cases: readonly { readonly given: readonly string[] }[];
  readonly files: Readonly<Record<string, string>>;
}): Promise<readonly string[]> =>
  (
    await Promise.all(
      request.cases.map(({ given }) => printedHelpBlockOf({ given, files: request.files })),
    )
  ).toSorted();

const helpBlocksIn = (request: { readonly text: string }): readonly string[] =>
  [...request.text.matchAll(HELP_BLOCK)].map((match) => match[0]).toSorted();

const CONTRACT_TEXT = contractTextAt({
  path: `${import.meta.dirname}/../../docs/output-contract.md`,
});

const CONTRACT_PARTS = contractPartsOf({ text: CONTRACT_TEXT });

const README_TEXT = contractTextAt({ path: `${import.meta.dirname}/../../README.md` });

describe("contractGaps over written-out lines, so the contract reading can fail", () => {
  const FINDING_TEMPLATE: DocumentedLine = {
    label: "findings",
    template: "<clause> <mechanism> <file>:<line>:<column> <snippet>",
  };

  const FINDING_FILLS: Fills = {
    clause: "CD-15#loops",
    mechanism: "audit",
    file: "src/a.ts",
    line: "2",
    column: "0",
    snippet: "const total = 0;",
  };

  it("refuses a printed line whose fields come in another order than the template's", () => {
    expect(
      contractGaps({
        documented: [FINDING_TEMPLATE],
        printed: [
          {
            label: "findings",
            text: "audit CD-15#loops src/a.ts:2:0 const total = 0;",
            fills: FINDING_FILLS,
          },
        ],
      }),
    ).toEqual({
      undocumented: [
        {
          label: "findings",
          text: "audit CD-15#loops src/a.ts:2:0 const total = 0;",
          fills: FINDING_FILLS,
        },
      ],
      unprinted: [FINDING_TEMPLATE],
    });
  });

  it("refuses a printed line whose separators differ from the template's", () => {
    expect(
      contractGaps({
        documented: [FINDING_TEMPLATE],
        printed: [
          {
            label: "findings",
            text: "CD-15#loops -- audit src/a.ts:2:0 const total = 0;",
            fills: FINDING_FILLS,
          },
        ],
      }),
    ).toEqual({
      undocumented: [
        {
          label: "findings",
          text: "CD-15#loops -- audit src/a.ts:2:0 const total = 0;",
          fills: FINDING_FILLS,
        },
      ],
      unprinted: [FINDING_TEMPLATE],
    });
  });

  it("names a printed line no template fits and a template no printed line fits", () => {
    expect(
      contractGaps({
        documented: [{ label: "verdict", template: "verdict: pass (partial assessment)" }],
        printed: [{ label: "verdict", text: "verdict: pass", fills: {} }],
      }),
    ).toEqual({
      undocumented: [{ label: "verdict", text: "verdict: pass", fills: {} }],
      unprinted: [{ label: "verdict", template: "verdict: pass (partial assessment)" }],
    });
  });
});

describe("docs/output-contract.md, read against every line the command can print (CD-47: the shipped contract page is the assertion's subject; nothing is spawned)", () => {
  it("documents every printed line as its template filled with that line's own sample values, and every documented line is one the command prints", () => {
    expect(
      contractGaps({
        documented: documentedLinesIn({ text: CONTRACT_PARTS.versionOne }),
        printed: PRINTABLE_LINES,
      }),
    ).toEqual({
      undocumented: [],
      unprinted: [],
    });
  });

  it("fills every placeholder of an upgrade success line with a value its definition allows, and defines each in the values table", () => {
    const filledAgainstForm = UPGRADE_SUCCESS_LINES.flatMap(({ fills }) =>
      Object.entries(fills).filter(
        ([placeholder, filled]) => !(UPGRADE_PLACEHOLDER_FORMS[placeholder]?.test(filled) ?? false),
      ),
    );
    const defined = definedPlaceholdersIn({ text: CONTRACT_PARTS.versionOne });
    const undefinedNames = Object.keys(UPGRADE_PLACEHOLDER_FORMS).filter(
      (name) => !defined.has(name),
    );
    expect({ filledAgainstForm, undefinedNames }).toEqual({
      filledAgainstForm: [],
      undefinedNames: [],
    });
  });

  it("lists every report section in the order the report prints them, with its role", () => {
    expect(documentedRolesIn({ text: CONTRACT_PARTS.versionOne })).toEqual(PRINTED_SECTION_ROLES);
  });

  it.each(PRINTED_BLOCKS)("shows the synopsis and each help exactly as printed: %s", (block) => {
    expect(CONTRACT_PARTS.versionOne).toContain(block);
  });

  it("pins the README to the version 2 run synopsis, which no command prints yet", () => {
    expect(README_TEXT).toContain(RUN_PRINTED_BLOCKS[0]);
  });
});

describe("the version 2 part of docs/output-contract.md, read against every line the version 2 report can print", () => {
  it("documents every printed line as its template filled with that line's own sample values, and every documented line is one the report prints", () => {
    expect(
      contractGaps({
        documented: documentedLinesIn({ text: CONTRACT_PARTS.versionTwo }),
        printed: [...RUN_PRINTABLE_LINES, ...RUN_FAILURE_LINES, ...RECORD_COMMAND_LINES],
      }),
    ).toEqual({
      undocumented: [],
      unprinted: [],
    });
  });

  it("lists every version 2 report section in the order the report prints them, with its role", () => {
    expect(documentedRolesIn({ text: CONTRACT_PARTS.versionTwo })).toEqual(RUN_SECTION_ROLES);
  });

  it.each(RUN_PRINTED_BLOCKS)(
    "shows the version 2 synopsis and each help exactly as printed: %s",
    (block) => {
      expect(CONTRACT_PARTS.versionTwo).toContain(block);
    },
  );
});

const VERSION_TWO_REPOSITORY = { "hone.config.json": "{}" };

const VERSION_TWO_HELP_CASES = [
  { topic: "the tool", given: ["--help"] },
  { topic: "check", given: ["check", "--repo", "/repo", "--help"] },
  { topic: "project", given: ["project", "--repo", "/repo", "--help"] },
  { topic: "record-debt", given: ["record-debt", "--repo", "/repo", "--help"] },
  { topic: "prune-debt", given: ["prune-debt", "--repo", "/repo", "--help"] },
  { topic: "authorise", given: ["authorise", "--repo", "/repo", "--help"] },
  { topic: "upgrade", given: ["upgrade", "--repo", "/repo", "--help"] },
] as const;

describe("the help docs/output-contract.md shows for version 2, read against what hone prints for a version 2 repository", () => {
  it.each(VERSION_TWO_HELP_CASES)(
    "shows the help of $topic exactly as the command prints it",
    async ({ given }) => {
      expect(CONTRACT_PARTS.versionTwo).toContain(
        await printedHelpBlockOf({ given, files: VERSION_TWO_REPOSITORY }),
      );
    },
  );

  it("shows no help block the command does not print, so a stale or extra block fails", async () => {
    expect(helpBlocksIn({ text: CONTRACT_PARTS.versionTwo })).toEqual(
      await printedHelpBlocksOf({ cases: VERSION_TWO_HELP_CASES, files: VERSION_TWO_REPOSITORY }),
    );
  });

  it("shows, in the 1.x part, the split-records help the command prints for a version 2 repository", async () => {
    expect(CONTRACT_PARTS.versionOne).toContain(
      await printedHelpBlockOf({
        given: ["split-records", "--repo", "/repo", "--help"],
        files: VERSION_TWO_REPOSITORY,
      }),
    );
  });
});
