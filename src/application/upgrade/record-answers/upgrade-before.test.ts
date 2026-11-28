import { describe, expect, it, vi } from "vitest";

import type {
  AuthorisedLocationKind,
  Check,
  Symptom,
  SymptomCatalogue,
  UnboundRecordKind,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import type { ConsumerSelectionFile } from "../../../domain/settings/selection/selection-file.ts";
import type { SelectionReading } from "../../../domain/settings/selection/selection.ts";
import type { SelectionRepository } from "../../ports/selection/selection-repository.ts";
import type { VersionOneProjectionInspection } from "../../ports/upgrade/version-one-projection-port.ts";
import { createUpgradeBefore } from "./upgrade-before.ts";

const REPO = absoluteRootOf("/repo");
const INSTALL = absoluteRootOf("/install");
const SELECTION: ConsumerSelectionFile = {
  version: 1,
  ruleSets: [],
  clauses: [],
  exclude: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "optional",
  reportOutput: "full",
  assessment: { forfeiture: "this-run" },
  clauseSettings: [],
  checkEditions: "pinned",
};
const ABSENT: LoadFailure = { kind: "selection-absent", repo: REPO };

const CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const LOOP_KEYWORD: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "A loop.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const LOOP: Check = {
  name: "loops",
  symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
  page: "loop-keyword/loops.md",
  clause: CLAUSE,
  engines: [{ name: "eslint" }],
  forms: [],
  findingSpecifics: [],
};

const DEBT: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [DEBT, AUTHORISED],
  engines: LOOP.engines,
  symptoms: [LOOP_KEYWORD],
  clauses: [{ clause: CLAUSE, sight: { kind: "one-symptom", symptom: LOOP.symptom } }],
  checks: [LOOP],
  namedBans: [],
};

const FIRST = editionOf("1");

const PIECE = {
  exceptions: "allowed",
  anchor: { kind: "file" },
  pieceRoot: "/install/eslint/loop-keyword/loops",
  settings: {},
  declarations: {},
  forms: {},
  editions: { declared: [FIRST], default: FIRST, latest: FIRST },
} as const;

const ESLINT_MEASURED = {
  report: {
    mechanism: "eslint",
    coverableKinds: [],
    hits: [],
    measured: [],
    nativeExceptions: [],
    projection: "current",
    coverage: { kind: "scoped", candidateFiles: [], inapplicable: [] },
    comparedOutputs: [],
    slices: [],
    nestedConfigurations: [],
    unprojectedFolders: [],
    misnamedRuleIds: [],
  },
  unappliedSlices: [],
} as const;

const ESLINT_SELECTION: SelectionReading = {
  selection: {
    selected: [{ address: CLAUSE, mechanism: "eslint", exceptions: "allowed" }],
    uncovered: [],
    notAdopted: [],
    notRun: [],
    editions: [],
  },
  bindings: [
    {
      mechanism: "eslint",
      clause: {
        address: CLAUSE,
        anchor: { kind: "file" },
        pieceRoot: "/install/eslint/loop-keyword/loops",
        settings: {},
        clauseSettings: {},
        edition: FIRST,
      },
    },
  ],
  clauseRoots: [],
  excluded: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "optional",
};

const SOURCES = {
  settingsFile: vi.fn(),
  ruleSetRoot: vi.fn().mockReturnValue({ outcome: "ok", value: INSTALL }),
  catalogue: vi.fn().mockReturnValue({
    outcome: "ok",
    value: { held: "catalogue", catalogue: CATALOGUE },
  }),
};

const INSPECTED: VersionOneProjectionInspection = {
  files: [repoPathOf("disciplines.eslint.mjs"), repoPathOf("packages/a/disciplines.eslint.mjs")],
  ruleIds: new Map([["CD-15#loops", "hone/no-loops"]]),
};

const inputsWith = (
  read: SelectionRepository["read"],
): Parameters<typeof createUpgradeBefore>[0] => ({
  selection: SELECTION,
  catalogues: [],
  check: {
    repoRoot: REPO,
    installRoot: INSTALL,
    moduleExtension: ".ts",
    baseRevision: undefined,
    assessment: SELECTION.assessment,
    fileText: { exists: vi.fn(), read: vi.fn() },
    modules: { load: vi.fn() },
    path: {
      join: vi.fn(),
      joinRepository: vi.fn(),
      relative: vi.fn(),
      directoryOf: vi.fn(),
      repositoryDirectoryOf: vi.fn(),
      resolve: vi.fn(),
      fromFileUrl: vi.fn(),
    },
    git: {
      trackedPaths: vi.fn(),
      changedSince: vi.fn(),
      contentInBase: vi.fn(),
      textInBase: vi.fn(),
      renamedSince: vi.fn(),
    },
    exceptionRepository: { read: vi.fn(), readAt: vi.fn() },
    exceptionEntryParser: {
      parseExceptionEntries: vi.fn(),
      importedEntriesIn: vi.fn(),
      importSourcesOf: vi.fn(),
    },
    selectionRepository: { read },
  },
  measureVersionOne: vi.fn(),
  sources: { settingsFile: vi.fn(), ruleSetRoot: vi.fn(), catalogue: vi.fn() },
  readPiece: vi.fn(),
  projection: { inspect: vi.fn(), prepare: vi.fn() },
  loadFailureDetail: () => "selection is absent",
});

describe("createUpgradeBefore", () => {
  it("reads the version one selection once, at first use, and shares the refusal across its calls", async () => {
    const read = vi
      .fn<SelectionRepository["read"]>()
      .mockReturnValue({ outcome: "failed", error: ABSENT });
    const input = inputsWith(read);
    const before = createUpgradeBefore(input);
    expect(read).not.toHaveBeenCalled();

    await expect(before.report()).resolves.toEqual({ outcome: "failed", error: ABSENT });
    await expect(before.enginePass.findingsFor({ records: [] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "version-one-run-failed", detail: "selection is absent" },
    });
    await expect(before.prepareProjections([])).resolves.toEqual({
      outcome: "failed",
      error: ABSENT,
    });

    expect(read).toHaveBeenCalledExactlyOnceWith({});
    expect(input.check.git.trackedPaths).not.toHaveBeenCalled();
    expect(input.projection.inspect).not.toHaveBeenCalled();
  });

  it("measures version 1 under every projection file and rule id the inspection names", async () => {
    const read = vi.fn<SelectionRepository["read"]>().mockReturnValue({
      outcome: "ok",
      value: ESLINT_SELECTION,
    });
    const input = inputsWith(read);
    const measureVersionOne = vi
      .fn<typeof input.measureVersionOne>()
      .mockResolvedValue({ outcome: "ok", value: ESLINT_MEASURED });
    const before = createUpgradeBefore({
      ...input,
      selection: { ...SELECTION, clauses: [[CLAUSE, { state: "run", mechanism: "eslint" }]] },
      catalogues: [{ ruleSet: TOOL_RULE_SET, catalogue: CATALOGUE }],
      check: {
        ...input.check,
        git: {
          ...input.check.git,
          trackedPaths: vi.fn().mockReturnValue({ outcome: "ok", value: [] }),
        },
      },
      sources: SOURCES,
      readPiece: vi.fn().mockReturnValue({ outcome: "ok", value: PIECE }),
      projection: {
        inspect: vi
          .fn<typeof input.projection.inspect>()
          .mockResolvedValue({ outcome: "ok", value: INSPECTED }),
        prepare: vi.fn(),
      },
      measureVersionOne,
    });

    const found = await before.enginePass.findingsFor({ records: [] });

    expect(found).toEqual({
      outcome: "ok",
      value: {
        findings: [],
        runs: [{ mechanism: "eslint", coverableKinds: [], nativeExceptions: [] }],
      },
    });
    expect(measureVersionOne).toHaveBeenCalledExactlyOnceWith({
      request: expect.objectContaining({
        bindings: [expect.objectContaining({ engine: "eslint" })],
      }),
      location: expect.anything(),
      projection: {
        settingsFile: "disciplines.json",
        projectionFile: "disciplines.eslint.mjs",
        packageFiles: ["packages/a/disciplines.eslint.mjs"],
        rules: new Map([["loop-keyword#loops", "hone/no-loops"]]),
      },
    });
  });
});
