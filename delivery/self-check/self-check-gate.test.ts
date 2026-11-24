import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import type { GitPort } from "../../src/application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../../src/application/ports/host/module-loader-port.ts";
import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import type { ShownPathOfRepository } from "../../src/application/ports/installation/shown-path-of.ts";
import type { ExceptionEntryParser } from "../../src/application/ports/records/exception-entries.ts";
import type { ExceptionRepositoryOf } from "../../src/application/ports/records/exception-repository.ts";
import type { SelectionRepositoryOf } from "../../src/application/ports/selection/selection-repository.ts";
import type { VersionOneCommandRequest } from "../../src/application/ports/version-one-command-request.ts";
import type { VersionTwoCheckRun } from "../../src/composition/check-command.ts";
import type {
  AttributedCheckException,
  CheckFinding,
} from "../../src/domain/finding/governance.ts";
import type {
  RecordKind,
  SymptomCatalogue,
} from "../../src/domain/language-layer/symptom-catalogue.ts";
import type { RunReport } from "../../src/domain/report/run-report.ts";
import { absoluteRootOf } from "../../src/domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../src/domain/repository/repo-path-of.ts";
import type { VersionTwoReportOutput } from "../../src/domain/settings/report-output.ts";
import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import { runSelfCheck, versionTwoSelfCheckOutcomeOf } from "./self-check-gate.ts";

const PROJECT_COMMAND = "node src/hone.ts project --repo .";

const PRUNE_COMMAND = "node src/hone.ts prune-debt --repo .";

const EMPTY_RUN_REPORT: RunReport = {
  excluded: [],
  "not-adopted": [],
  "not-run": [],
  editions: [],
  findings: [],
  answered: [],
  held: [],
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

const NAMED_CLASS_IN_A: CheckFinding = {
  check: "class-declared#class-syntax",
  file: repoPathOf("src/a.ts"),
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
  mechanism: "walker",
};

const IGNORED_IN_A: AttributedCheckException = {
  kind: "ignore",
  check: "class-declared#class-syntax",
  file: repoPathOf("src/a.ts"),
  mechanism: "eslint",
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

const EMPTY_CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  engines: [],
  symptoms: [],
  clauses: [],
  checks: [],
  namedBans: [],
};

const SELF_CHECK_PORTS = {
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: {
    exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
    read: vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "unreadable", path: "/repo/package.json", detail: "absent" },
    }),
    write: vi.fn<FileTextPort["write"]>(),
  },
};

const producedOf = (request: {
  readonly report: RunReport;
  readonly output: VersionTwoReportOutput;
}): VersionTwoCheckRun => ({
  located: { repoRoot: absoluteRootOf("/repo"), installRoot: absoluteRootOf("/install") },
  commands: { projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND },
  run: {
    report: request.report,
    catalogue: EMPTY_CATALOGUE,
    content: { symptoms: new Map() },
    touched: { measured: "yes", paths: new Set() },
    output: request.output,
    runs: [],
    moved: [],
  },
});

describe("versionTwoSelfCheckOutcomeOf", () => {
  it("passes a clean run, printing the gate line as its only verdict", () => {
    expect(
      versionTwoSelfCheckOutcomeOf({
        ports: SELF_CHECK_PORTS,
        produced: producedOf({ report: EMPTY_RUN_REPORT, output: "full" }),
      }),
    ).toEqual({
      code: 0,
      text: "self-check: pass, no failing section holds an entry\n",
    });
  });

  it("fails a run holding findings and unrecorded native exceptions, naming both after the report's sections", () => {
    expect(
      versionTwoSelfCheckOutcomeOf({
        ports: SELF_CHECK_PORTS,
        produced: producedOf({
          report: {
            ...EMPTY_RUN_REPORT,
            findings: [NAMED_CLASS_IN_A],
            unrecorded: [IGNORED_IN_A, IGNORED_IN_A],
          },
          output: "counts",
        }),
      }),
    ).toEqual({
      code: 1,
      text: "findings (1)\nunrecorded (2)\nself-check: fail, failing sections hold entries: findings (1), unrecorded (2)\n",
    });
  });

  it("marks the gate line as a partial assessment when part of the assessment was left to another run, though the output hides the assessment section", () => {
    expect(
      versionTwoSelfCheckOutcomeOf({
        ports: SELF_CHECK_PORTS,
        produced: producedOf({
          report: {
            ...EMPTY_RUN_REPORT,
            assessment: [{ concern: "forfeiture", assessedBy: "elsewhere", debts: 2 }],
          },
          output: "actionable",
        }),
      }),
    ).toEqual({
      code: 0,
      text: "self-check: pass (partial assessment), no failing section holds an entry\n",
    });
  });

  it("fails naming each failing section that holds an entry, in the order the report lists them", () => {
    expect(
      versionTwoSelfCheckOutcomeOf({
        ports: SELF_CHECK_PORTS,
        produced: producedOf({
          report: {
            ...EMPTY_RUN_REPORT,
            findings: [NAMED_CLASS_IN_A],
            misnamed: [
              {
                kind: "names-no-check",
                ruleId: "hone/no-such-check",
                file: repoPathOf("src/a.ts"),
                line: 3,
                text: "// eslint-disable-line hone/no-such-check",
              },
            ],
            refused: [
              {
                place: { file: repoPathOf("hone-records/debt/loop-keyword.json"), index: 1 },
                refusals: [{ kind: "carried-changed-since-base" }],
              },
            ],
            unmeasured: [{ kind: "import-unmeasured", base: { state: "not-given" } }],
          },
          output: "counts",
        }),
      }),
    ).toEqual({
      code: 1,
      text: "findings (1)\nmisnamed (1)\nrefused (1)\nunmeasured (1)\nself-check: fail, failing sections hold entries: findings (1), misnamed (1), refused (1), unmeasured (1)\n",
    });
  });

  it("marks a failing gate line as a partial assessment too", () => {
    expect(
      versionTwoSelfCheckOutcomeOf({
        ports: SELF_CHECK_PORTS,
        produced: producedOf({
          report: {
            ...EMPTY_RUN_REPORT,
            unmeasured: [{ kind: "import-unmeasured", base: { state: "not-given" } }],
            assessment: [{ concern: "carried-standing", assessedBy: "elsewhere", carried: 1 }],
          },
          output: "verdict-only",
        }),
      }),
    ).toEqual({
      code: 1,
      text: "self-check: fail (partial assessment), failing sections hold entries: unmeasured (1)\n",
    });
  });
});

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const requestOver = (request: { readonly process: ProcessPort }): VersionOneCommandRequest => ({
  process: request.process,
  path: {
    join: vi.fn<PathPort["join"]>(),
    relative: vi.fn<PathPort["relative"]>(),
    joinRepository: vi.fn<PathPort["joinRepository"]>(),
    directoryOf: vi.fn<PathPort["directoryOf"]>(),
    repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
    resolve: vi.fn<PathPort["resolve"]>(),
    fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
  },
  fileText: {
    read: vi.fn<FileTextPort["read"]>(),
    exists: vi.fn<FileTextPort["exists"]>(),
    write: vi.fn<FileTextPort["write"]>(),
  },
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
    changedSince: vi.fn<GitPort["changedSince"]>(),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
    renamedSince: vi.fn<GitPort["renamedSince"]>(),
  },
  exceptionRepositoryOf: vi.fn<ExceptionRepositoryOf>(),
  exceptionEntryParser: {
    parseExceptionEntries: vi.fn<ExceptionEntryParser["parseExceptionEntries"]>(),
    importedEntriesIn: vi.fn<ExceptionEntryParser["importedEntriesIn"]>(),
    importSourcesOf: vi.fn<ExceptionEntryParser["importSourcesOf"]>(),
  },
  selectionRepositoryOf: vi.fn<SelectionRepositoryOf>(),
  shownPathOfRepository: vi.fn<ShownPathOfRepository>(),
  moduleUrl: "file:///install/src/hone.ts",
});

describe("runSelfCheck", () => {
  it("takes the hone subcommands, so a missing one exits 2 with the arguments-invalid line and reads nothing", async () => {
    const processPort = processWith({ arguments: ["--repo", "."] });
    const request = requestOver({ process: processPort });

    await runSelfCheck(request);

    expect({
      writes: vi.mocked(processPort.writeOut).mock.calls,
      exits: vi.mocked(processPort.exitWith).mock.calls,
      reads: vi.mocked(request.fileText.read).mock.calls,
    }).toEqual({
      writes: [
        [
          {
            text: expect.stringMatching(
              /^load failure: arguments-invalid hone has no command "--repo"; /,
            ),
          },
        ],
      ],
      exits: [[{ code: 2 }]],
      reads: [],
    });
  });
});
