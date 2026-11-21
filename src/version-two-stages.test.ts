import { describe, expect, it, vi } from "vitest";
import type { Case, Check, Engine, Pointed, Principle, Recipe, RecordKind, Rule, Symptom, SymptomCatalogue } from "./domain/language-layer/symptom-catalogue.ts";
import { clauseAddressSchema } from "./infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "./infrastructure/hone-config-file/identifiers.ts";
import type { DirectoryPort } from "./infrastructure/node/file-system/file-system-port.ts";
import type { FileTextPort } from "./infrastructure/node/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "./infrastructure/git/git-port.ts";
import type { ModuleLoaderPort } from "./infrastructure/node/modules/module-loader-port.ts";
import { createPathPort } from "./infrastructure/node/path-port.ts";
import type { RecordsReading, SymptomReach } from "./infrastructure/hone-records-folder/hone-record.ts";
import { DEFAULT_CONVENTIONS } from "./domain/settings/conventions.ts";
import type { SettingsReading } from "./application/run/settings/read-settings.ts";
import { absolutePathSchema } from "./infrastructure/content-files/absolute-path.ts";
import { repoPathSchema } from "./infrastructure/hone-records-folder/repo-path.ts";
import { createRecordsFolder } from "./infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import { type VersionTwoPorts, versionTwoStagesOver } from "./version-two-stages.ts";

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const WALKER: Engine = { name: "walker", mechanism: AUDIT };

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: ESLINT };

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const AT_A_BOUNDARY: Principle = { name: "external-behaviour-sits-at-a-boundary", title: "External behaviour sits at a boundary" };

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const PORTS_DECLARED_INSIDE: Rule = { name: "ports-declared-inside", title: "Ports declared inside", principle: AT_A_BOUNDARY, standing: "accepted" };

const WRITTEN_OUT_ANSWERS: Rule = { name: "written-out-answers", title: "Written-out answers", principle: TESTS_ARE_OURS, standing: "accepted" };

const DOER_OR_ORCHESTRATOR: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: ONE_PLACE_DECIDES, standing: "accepted" };

const STRAIGHT_THROUGH_TESTS: Rule = { name: "straight-through-tests", title: "Straight-through tests", principle: TESTS_ARE_OURS, standing: "accepted" };

const DECLARED_NOT_ASSERTED: Rule = { name: "declared-not-asserted", title: "Declared, not asserted", principle: ONE_PLACE_DECIDES, standing: "accepted" };

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

const OWED_DECLARED_NOT_ASSERTED: Pointed = { kind: "rule", rule: DECLARED_NOT_ASSERTED };

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

const ASSERT_TO_NARROW: Recipe = { name: "assert-to-narrow", title: "Assert to narrow", standing: "accepted", reason: { text: "it narrows the type", standing: "accepted" } };

const ITEACH_OVER_TYPED_ROWS: Recipe = { name: "iteach-over-typed-rows", title: "it.each over typed rows", standing: "accepted", reason: { text: "each row is a case", standing: "accepted" } };

const BOUNDARY_RECORD_KIND: RecordKind = { name: "boundary-record", title: "Boundary record", phrase: "a boundary record", todaysFormat: "authorised-location" };

const DEBT_KIND: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION_KIND: RecordKind = { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" };

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
  correctUses: [{ situation: "correct use", kind: BOUNDARY_RECORD_KIND, at: "on the clock adapter" }],
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

const CLAIMED_TYPE: Symptom = {
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [{ case: GIVES_A_VALUE_ITS_TYPE, situation: "or needs it narrower", points: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }] }],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [{ situation: "a schema proves the type", kind: AUTHORISED_LOCATION_KIND }],
};

const CLOCK_SOURCES = clauseAddressSchema.parse("CD-17#clock-sources");

const TEST_BODY_LOGIC = clauseAddressSchema.parse("CD-27#test-body-logic");

const CAST_EXPRESSIONS = clauseAddressSchema.parse("CD-2#cast-expressions");

const CLOCK_CHECK: Check = { name: "clock-sources", symptom: DATE_USED_DIRECTLY, clause: CLOCK_SOURCES, engines: [WALKER], forms: [] };

const TEST_BODY_CHECK: Check = { name: "test-body", symptom: BRANCH_IN_A_TEST, clause: TEST_BODY_LOGIC, engines: [WALKER], forms: ["branching-with-if"] };

const CAST_CHECK: Check = { name: "cast-expressions", symptom: CLAIMED_TYPE, clause: CAST_EXPRESSIONS, engines: [ESLINT_ENGINE], forms: [] };

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [TESTS_ARE_OURS, AT_A_BOUNDARY, ONE_PLACE_DECIDES, NO_HIDDEN_EFFECTS],
  rules: [PORTS_DECLARED_INSIDE, WRITTEN_OUT_ANSWERS, DOER_OR_ORCHESTRATOR, STRAIGHT_THROUGH_TESTS, DECLARED_NOT_ASSERTED],
  cases: [NEEDS_THE_CURRENT_TIME, DOES_ONE_JOB, CHECKS_A_VALUE, GIVES_A_VALUE_ITS_TYPE],
  recipes: [WORLD_VALUES_THROUGH_A_PORT, ASSERT_TO_NARROW, ITEACH_OVER_TYPED_ROWS],
  recordKinds: [AUTHORISED_LOCATION_KIND, BOUNDARY_RECORD_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [DATE_USED_DIRECTLY, BRANCH_IN_A_TEST, CLAIMED_TYPE],
  clauses: [
    { clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } },
    { clause: TEST_BODY_LOGIC, sight: { kind: "symptom-by-form", forms: [{ section: "branching-with-if", symptom: BRANCH_IN_A_TEST }] } },
    { clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } },
  ],
  checks: [CLOCK_CHECK, TEST_BODY_CHECK, CAST_CHECK],
  namedBans: [{ outsideDependency: "lodash" }],
};

const REPO = absolutePathSchema.parse("/repo");

const INSTALL = absolutePathSchema.parse("/install");

const NOTHING_PRESENT: Pick<FileTextPort, "exists" | "read"> = {
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
  read: vi.fn<FileTextPort["read"]>(),
};

const gitListing = (request: { readonly tracked: GitPort["trackedPaths"] }): GitPort => ({
  trackedPaths: request.tracked,
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const portsOver = (request: { readonly git: GitPort }): VersionTwoPorts => ({
  fileText: { ...NOTHING_PRESENT, write: vi.fn<FileTextPort["write"]>() },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: request.git,
  gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
  directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
  recordsSourceOf: createRecordsFolder,
});

const GIT_LISTING_NOTHING = gitListing({ tracked: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: [] }) });

const stagesOver = (request: { readonly git: GitPort; readonly baseRevision: string | undefined }) =>
  versionTwoStagesOver({ ports: portsOver(request), locations: { repoRoot: REPO, installRoot: INSTALL, moduleExtension: ".ts", baseRevision: request.baseRevision } });

const SETTINGS: SettingsReading = {
  selection: {
    selection: { selected: [], uncovered: [], notAdopted: [], notRun: [], editions: [] },
    bindings: [],
    clauseRoots: [],
    excluded: [],
    eslintConfigRoots: [],
    fileExceptionWhyChains: "required",
  },
  runSettings: { reportOutput: "full", assessment: { forfeiture: "this-run" } },
  eslintConfigLookup: { lookup: "detected" },
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
};

describe("versionTwoStagesOver", () => {
  it("fails as a catalogue not read, absent, when the install holds no symptom catalogue", () => {
    expect(stagesOver({ git: GIT_LISTING_NOTHING, baseRevision: undefined }).catalogue()).toEqual({
      outcome: "failed",
      error: { kind: "catalogue-not-read", path: "/install/rules/typescript/symptoms.json", reason: { reason: "absent" } },
    });
  });

  it("fails as config absent when the repository holds no hone.config.json", () => {
    expect(stagesOver({ git: GIT_LISTING_NOTHING, baseRevision: undefined }).settings({ catalogue: REPORT_CATALOGUE })).toEqual({
      outcome: "failed",
      error: { kind: "config-absent", repo: "/repo" },
    });
  });

  it("reads no records, and says no base revision was given, when the repository holds no hone-records folder and none was passed", () => {
    expect(stagesOver({ git: GIT_LISTING_NOTHING, baseRevision: undefined }).records({ catalogue: REPORT_CATALOGUE })).toEqual({
      outcome: "ok",
      value: { records: [], refused: [], notes: [], base: { measured: "no", base: { state: "not-given" } } },
    });
  });

  it("fails as a git failure when git cannot list the tracked files", () => {
    const failing = gitListing({
      tracked: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "failed", error: { kind: "git-failed", command: "git ls-files", detail: "not a repository" } }),
    });
    expect(stagesOver({ git: failing, baseRevision: undefined }).tree({ settings: SETTINGS })).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", detail: "git ls-files: not a repository" },
    });
  });

  it("touches nothing when no record is debt, without asking git", () => {
    const git = gitListing({ tracked: vi.fn<GitPort["trackedPaths"]>() });
    const records: RecordsReading = { records: [], refused: [], notes: [], base: { measured: "yes" } };
    expect(stagesOver({ git, baseRevision: "origin/main" }).touched({ assessment: { forfeiture: "this-run" }, measuring: "when-debt-held", records })).toEqual({ measured: "yes", paths: new Set() });
    expect(vi.mocked(git.changedSince).mock.calls).toEqual([]);
  });

  it("measures the files changed since the base revision when a record is debt", () => {
    const git = gitListing({ tracked: vi.fn<GitPort["trackedPaths"]>() });
    vi.mocked(git.changedSince).mockReturnValue({ outcome: "ok", value: [repoPathSchema.parse("src/a.ts")] });
    const records: RecordsReading = {
      records: [
        {
          place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: 0 },
          record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: repoPathSchema.parse("src/a.ts"), holding: { held: "stated" } },
        },
      ],
      refused: [],
      notes: [],
      base: { measured: "yes" },
    };
    expect(stagesOver({ git, baseRevision: "origin/main" }).touched({ assessment: { forfeiture: "this-run" }, measuring: "when-debt-held", records })).toEqual({
      measured: "yes",
      paths: new Set([repoPathSchema.parse("src/a.ts")]),
    });
  });
});
