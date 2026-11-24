import { afterAll, assert, describe, expect, it, vi } from "vitest";

import type { GitPort } from "../../src/application/ports/git-port.ts";
import type { ExceptionRepository } from "../../src/application/ports/records/exception-repository.ts";
import type { FileCarveOutRecord } from "../../src/application/ports/upgrade/record-answer-oracle.ts";
import { createAnsweringOracle } from "../../src/application/upgrade/record-answers/answering-oracle.ts";
import { createUpgradeBefore } from "../../src/application/upgrade/record-answers/upgrade-before.ts";
import type { VersionOneCheckInput } from "../../src/application/upgrade/record-answers/version-one-check-input.ts";
import { runnerEnginesOver } from "../../src/composition/runner-engines.ts";
import type { Finding } from "../../src/domain/finding/governance.ts";
import type { Check, Symptom } from "../../src/domain/language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../src/domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../src/domain/repository/repo-path-types.ts";
import { TOOL_RULE_SET } from "../../src/domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../src/domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../src/domain/rule-set/discipline-id-of.ts";
import type { RuleSetCatalogue } from "../../src/domain/settings/check-choices.ts";
import type { ConsumerSelectionFile } from "../../src/domain/settings/selection/selection-file.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { exceptionEntryParser } from "../../src/infrastructure/discipline-exceptions-folder/exception-records.ts";
import { createSelectionRepository } from "../../src/infrastructure/disciplines-file/consumer-selection.ts";
import {
  defaultEslintToolchainPeers,
  loadEslintToolchain,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { runnerModuleAt } from "../../src/infrastructure/engines/protocol/runner-module/runner-module-at.ts";
import { DEFAULT_ASSESSMENT } from "../../src/infrastructure/hone-config-file/assessment.ts";
import {
  createCheckPieceSource,
  createSettingsSources,
} from "../../src/infrastructure/hone-config-file/settings-sources.ts";
import { createDefaultFileRemovalPort } from "../../src/infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { loadFailureDetail } from "../../src/infrastructure/printed-report/load-failures/load-failure-text.ts";
import { createDefaultScratchFilesPort } from "../install-proof/install-proof-ports.ts";

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const modules = createDefaultModuleLoaderPort({});

const RUNNER_ENGINES = runnerEnginesOver({ runnerModuleOf: runnerModuleAt });

const INSTALL_ROOT = absolutePathSchema.parse(
  path.join({ segments: [import.meta.dirname, "..", ".."] }),
);

const RAW_FINDING_REPO = absolutePathSchema.parse(
  `${INSTALL_ROOT}/artefacts/version-one-engine-pass-raw-finding`,
);

const NO_RECORDS_REPO = absolutePathSchema.parse(
  `${INSTALL_ROOT}/artefacts/version-one-engine-pass-no-records`,
);

const ORACLE_REPO = absolutePathSchema.parse(
  `${INSTALL_ROOT}/artefacts/version-one-engine-pass-oracle`,
);

const UNPROJECTED_REPO = absolutePathSchema.parse(
  `${INSTALL_ROOT}/artefacts/version-one-engine-pass-unprojected`,
);

const CLASS_SYNTAX = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-14"),
  clause: clauseIdOf("class-syntax"),
};

const STATIC_ONLY_CLASS = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-14"),
  clause: clauseIdOf("static-only-class"),
};

const AUTHORED_CLASS: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "authored-class-or-this",
  title: "Authored class or this",
  seen: "The class keyword in our code.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CLASS_KEYWORD_CHECK: Check = {
  name: "class-keyword",
  symptom: AUTHORED_CLASS,
  page: "authored-class-or-this/class-keyword.md",
  clause: CLASS_SYNTAX,
  forms: [],
  findingSpecifics: [],
  engines: [{ name: "walker" }, { name: "eslint" }],
};

const STATIC_MEMBERS_CHECK: Check = {
  name: "static-members-only",
  symptom: AUTHORED_CLASS,
  page: "authored-class-or-this/static-members-only.md",
  clause: STATIC_ONLY_CLASS,
  forms: [],
  findingSpecifics: [],
  engines: [{ name: "walker" }, { name: "eslint" }],
};

const CATALOGUES: readonly RuleSetCatalogue[] = [
  {
    ruleSet: TOOL_RULE_SET,
    catalogue: {
      principles: [],
      rules: [],
      cases: [],
      recipes: [],
      recordKinds: [],
      engines: [{ name: "walker" }, { name: "eslint" }],
      symptoms: [AUTHORED_CLASS],
      clauses: [
        { clause: CLASS_SYNTAX, sight: { kind: "one-symptom", symptom: AUTHORED_CLASS } },
        { clause: STATIC_ONLY_CLASS, sight: { kind: "one-symptom", symptom: AUTHORED_CLASS } },
      ],
      namedBans: [],
      checks: [CLASS_KEYWORD_CHECK, STATIC_MEMBERS_CHECK],
    },
  },
];

const SELECTION: ConsumerSelectionFile = {
  version: 1,
  ruleSets: [],
  clauses: [
    [CLASS_SYNTAX, { state: "run", mechanism: "eslint" }],
    [STATIC_ONLY_CLASS, { state: "run", mechanism: "eslint" }],
  ],
  exclude: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "required",
  reportOutput: "full",
  assessment: { forfeiture: "this-run" },
  clauseSettings: [],
  checkEditions: "pinned",
};

const REPO_PLATFORM: Omit<Parameters<typeof createSettingsSources>[0], "repoRoot"> = {
  fileText,
  path,
  directory: createDefaultDirectoryPort({}),
  installRoot: INSTALL_ROOT,
  moduleExtension: ".ts",
  toolRecordKinds: [],
};

const UPGRADE_INPUT = {
  engine: RUNNER_ENGINES.namedEngine,
  readPiece: createCheckPieceSource(REPO_PLATFORM),
  selection: SELECTION,
  catalogues: CATALOGUES,
  loadFailureDetail,
  measureVersionOne: RUNNER_ENGINES.measureVersionOne,
  projection: RUNNER_ENGINES.versionOneProjectionOf({
    ...REPO_PLATFORM,
    fileRemoval: createDefaultFileRemovalPort({}),
    modules,
  }),
};

const CHECK_PLATFORM: Omit<
  VersionOneCheckInput,
  "repoRoot" | "git" | "selectionRepository" | "exceptionRepository"
> = {
  installRoot: INSTALL_ROOT,
  moduleExtension: ".ts",
  fileText,
  path,
  modules,
  baseRevision: undefined,
  assessment: DEFAULT_ASSESSMENT,
  exceptionEntryParser,
};

const SELECTION_FILE =
  '{ "version": 1, "ruleSets": {}, "clauses": { "CD-14#class-syntax": "eslint", "CD-14#static-only-class": "eslint" } }\n';

const EXCEPTIONS =
  '{ "version": 1, "exceptions": [{ "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "src/kept.ts", "reason": "legacy class" }] }\n';

const TEAM_CONFIG =
  'import projection from "./disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...projection];\n';

const UNPROJECTING_CONFIG = 'export default [{ files: ["**/*.{ts,tsx,mts,cts}"] }];\n';

const KEPT_SOURCE = "export class Kept {}\n";

const DONE = { outcome: "ok", value: null };

const WRITTEN = { outcome: "ok", value: undefined };

const PROJECTED = {
  outcome: "ok",
  value: [{ effect: "written", path: "disciplines.eslint.mjs" }],
};

const KEPT = repoPathOf("src/kept.ts");

const CARVE_OUT: FileCarveOutRecord = {
  kind: "file-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: "eslint",
  file: KEPT,
  reason: "legacy class",
};

const CLASS_FINDING: Finding = {
  clause: CLASS_SYNTAX,
  file: KEPT,
  anchor: { line: 1, column: 7 },
  snippet: "export class Kept {}",
  mechanism: "eslint",
};

const CARVED_TRACKED: readonly RepoPath[] = [
  repoPathOf("disciplines.json"),
  repoPathOf("disciplines.eslint.mjs"),
  repoPathOf("eslint.config.mjs"),
  repoPathOf("discipline-exceptions.json"),
  repoPathOf("src/kept.ts"),
];

const UNPROJECTED_TRACKED: readonly RepoPath[] = [
  repoPathOf("disciplines.json"),
  repoPathOf("eslint.config.mjs"),
  repoPathOf("discipline-exceptions.json"),
  repoPathOf("src/kept.ts"),
];

afterAll(() => {
  scratch.removeTree({ path: RAW_FINDING_REPO });
  scratch.removeTree({ path: NO_RECORDS_REPO });
  scratch.removeTree({ path: ORACLE_REPO });
  scratch.removeTree({ path: UNPROJECTED_REPO });
});

describe("the toolchain the version 1 engine pass runs on", () => {
  it("is ESLint 10.15.0 from the development install", async () => {
    const loaded = await loadEslintToolchain({
      peers: defaultEslintToolchainPeers({ installRoot: INSTALL_ROOT, installForm: "source" }),
    });
    assert(loaded.outcome === "ok", "the eslint-10 toolchain loads from the development install");
    expect(loaded.value.eslintVersion).toBe("10.15.0");
  });
});

describe("the version 1 engine pass over a real ESLint run of a repository that carves out src/kept.ts", () => {
  it("returns the class finding raw, though the projection it ran under carries the carve-out as a config override", async () => {
    const repoRoot = RAW_FINDING_REPO;
    const before = createUpgradeBefore({
      ...UPGRADE_INPUT,
      sources: createSettingsSources({ ...REPO_PLATFORM, repoRoot }),
      check: {
        ...CHECK_PLATFORM,
        repoRoot,
        selectionRepository: createSelectionRepository({ ...REPO_PLATFORM, repoRoot }),
        exceptionRepository: {
          read: vi.fn<ExceptionRepository["read"]>(),
          readAt: vi.fn<ExceptionRepository["readAt"]>(),
        },
        git: {
          trackedPaths: vi
            .fn<GitPort["trackedPaths"]>()
            .mockReturnValue({ outcome: "ok", value: CARVED_TRACKED }),
          changedSince: vi.fn<GitPort["changedSince"]>(),
          contentInBase: vi.fn<GitPort["contentInBase"]>(),
          textInBase: vi.fn<GitPort["textInBase"]>(),
          renamedSince: vi.fn<GitPort["renamedSince"]>(),
        },
      },
    });
    expect([
      scratch.removeTree({ path: repoRoot }),
      scratch.makeDirectory({ path: `${repoRoot}/src` }),
      fileText.write({ path: `${repoRoot}/disciplines.json`, text: SELECTION_FILE }),
      fileText.write({ path: `${repoRoot}/discipline-exceptions.json`, text: EXCEPTIONS }),
      fileText.write({ path: `${repoRoot}/eslint.config.mjs`, text: TEAM_CONFIG }),
      fileText.write({ path: `${repoRoot}/src/kept.ts`, text: KEPT_SOURCE }),
      await before.prepareProjections([CARVE_OUT]),
    ]).toEqual([DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN, PROJECTED]);
    await expect(before.enginePass.findingsFor({ records: [CARVE_OUT] })).resolves.toEqual({
      outcome: "ok",
      value: {
        findings: [CLASS_FINDING],
        runs: [
          {
            mechanism: "eslint",
            coverableKinds: ["config-override", "inline-disable"],
            nativeExceptions: [],
          },
        ],
      },
    });
  });

  it("refuses the same projection when given no records, since the records are what its override was projected from", async () => {
    const repoRoot = NO_RECORDS_REPO;
    const before = createUpgradeBefore({
      ...UPGRADE_INPUT,
      sources: createSettingsSources({ ...REPO_PLATFORM, repoRoot }),
      check: {
        ...CHECK_PLATFORM,
        repoRoot,
        selectionRepository: createSelectionRepository({ ...REPO_PLATFORM, repoRoot }),
        exceptionRepository: {
          read: vi.fn<ExceptionRepository["read"]>(),
          readAt: vi.fn<ExceptionRepository["readAt"]>(),
        },
        git: {
          trackedPaths: vi
            .fn<GitPort["trackedPaths"]>()
            .mockReturnValue({ outcome: "ok", value: CARVED_TRACKED }),
          changedSince: vi.fn<GitPort["changedSince"]>(),
          contentInBase: vi.fn<GitPort["contentInBase"]>(),
          textInBase: vi.fn<GitPort["textInBase"]>(),
          renamedSince: vi.fn<GitPort["renamedSince"]>(),
        },
      },
    });
    expect([
      scratch.removeTree({ path: repoRoot }),
      scratch.makeDirectory({ path: `${repoRoot}/src` }),
      fileText.write({ path: `${repoRoot}/disciplines.json`, text: SELECTION_FILE }),
      fileText.write({ path: `${repoRoot}/discipline-exceptions.json`, text: EXCEPTIONS }),
      fileText.write({ path: `${repoRoot}/eslint.config.mjs`, text: TEAM_CONFIG }),
      fileText.write({ path: `${repoRoot}/src/kept.ts`, text: KEPT_SOURCE }),
      await before.prepareProjections([CARVE_OUT]),
    ]).toEqual([DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN, PROJECTED]);
    await expect(before.enginePass.findingsFor({ records: [] })).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "projection-not-current",
        file: "disciplines.eslint.mjs",
        state: "out-of-date",
      },
    });
  });

  it("lets the oracle credit the carve-out with the findings it holds", async () => {
    const repoRoot = ORACLE_REPO;
    const before = createUpgradeBefore({
      ...UPGRADE_INPUT,
      sources: createSettingsSources({ ...REPO_PLATFORM, repoRoot }),
      check: {
        ...CHECK_PLATFORM,
        repoRoot,
        selectionRepository: createSelectionRepository({ ...REPO_PLATFORM, repoRoot }),
        exceptionRepository: {
          read: vi.fn<ExceptionRepository["read"]>(),
          readAt: vi.fn<ExceptionRepository["readAt"]>(),
        },
        git: {
          trackedPaths: vi
            .fn<GitPort["trackedPaths"]>()
            .mockReturnValue({ outcome: "ok", value: CARVED_TRACKED }),
          changedSince: vi.fn<GitPort["changedSince"]>(),
          contentInBase: vi.fn<GitPort["contentInBase"]>(),
          textInBase: vi.fn<GitPort["textInBase"]>(),
          renamedSince: vi.fn<GitPort["renamedSince"]>(),
        },
      },
    });
    expect([
      scratch.removeTree({ path: repoRoot }),
      scratch.makeDirectory({ path: `${repoRoot}/src` }),
      fileText.write({ path: `${repoRoot}/disciplines.json`, text: SELECTION_FILE }),
      fileText.write({ path: `${repoRoot}/discipline-exceptions.json`, text: EXCEPTIONS }),
      fileText.write({ path: `${repoRoot}/eslint.config.mjs`, text: TEAM_CONFIG }),
      fileText.write({ path: `${repoRoot}/src/kept.ts`, text: KEPT_SOURCE }),
      await before.prepareProjections([CARVE_OUT]),
    ]).toEqual([DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN, PROJECTED]);
    const oracle = createAnsweringOracle({ enginePass: before.enginePass, catalogues: CATALOGUES });
    await expect(oracle.answer({ records: [CARVE_OUT] })).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: CARVE_OUT,
          answer: { credit: "findings", checks: [CLASS_KEYWORD_CHECK] },
        },
      ],
    });
  });
});

describe("the version 1 engine pass over a real ESLint run of a repository whose config does not include the projection", () => {
  it("fails the pass, since the run was not made", async () => {
    const repoRoot = UNPROJECTED_REPO;
    const before = createUpgradeBefore({
      ...UPGRADE_INPUT,
      sources: createSettingsSources({ ...REPO_PLATFORM, repoRoot }),
      check: {
        ...CHECK_PLATFORM,
        repoRoot,
        selectionRepository: createSelectionRepository({ ...REPO_PLATFORM, repoRoot }),
        exceptionRepository: {
          read: vi.fn<ExceptionRepository["read"]>(),
          readAt: vi.fn<ExceptionRepository["readAt"]>(),
        },
        git: {
          trackedPaths: vi
            .fn<GitPort["trackedPaths"]>()
            .mockReturnValue({ outcome: "ok", value: UNPROJECTED_TRACKED }),
          changedSince: vi.fn<GitPort["changedSince"]>(),
          contentInBase: vi.fn<GitPort["contentInBase"]>(),
          textInBase: vi.fn<GitPort["textInBase"]>(),
          renamedSince: vi.fn<GitPort["renamedSince"]>(),
        },
      },
    });
    expect([
      scratch.removeTree({ path: repoRoot }),
      scratch.makeDirectory({ path: `${repoRoot}/src` }),
      fileText.write({ path: `${repoRoot}/disciplines.json`, text: SELECTION_FILE }),
      fileText.write({ path: `${repoRoot}/discipline-exceptions.json`, text: EXCEPTIONS }),
      fileText.write({ path: `${repoRoot}/eslint.config.mjs`, text: UNPROJECTING_CONFIG }),
      fileText.write({ path: `${repoRoot}/src/kept.ts`, text: KEPT_SOURCE }),
    ]).toEqual([DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN]);
    await expect(before.enginePass.findingsFor({ records: [CARVE_OUT] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "disciplines.eslint.mjs", state: "missing" },
    });
  });
});
