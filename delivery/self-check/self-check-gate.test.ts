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
import type {
  AttributedCheckException,
  CheckFinding,
} from "../../src/domain/finding/governance.ts";
import type { RunReport } from "../../src/domain/report/run-report.ts";
import { repoPathOf } from "../../src/domain/repository/repo-path-of.ts";
import {
  runSelfCheck,
  VERSION_TWO_GATED_SECTIONS,
  versionTwoSelfCheckOutcomeOf,
} from "./self-check-gate.ts";

const PROJECT_COMMAND = "node src/hone.ts project --repo .";

const PRUNE_COMMAND = "node src/hone.ts prune-debt --repo .";

const EMPTY_RUN_REPORT: RunReport = {
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

describe("VERSION_TWO_GATED_SECTIONS", () => {
  it("names every failing section of a version 2 run except the findings and the unrecorded native exceptions, which are reported and not gated", () => {
    expect(VERSION_TWO_GATED_SECTIONS).toEqual([
      "stale",
      "forfeited",
      "misnamed",
      "refused",
      "unmeasured",
      "projection-problems",
    ]);
  });
});

describe("versionTwoSelfCheckOutcomeOf", () => {
  it("passes a clean run, printing the report and the gate line", () => {
    expect(
      versionTwoSelfCheckOutcomeOf({
        checked: { outcome: { code: 0, text: "verdict: pass\n" }, report: EMPTY_RUN_REPORT },
      }),
    ).toEqual({
      code: 0,
      text: "verdict: pass\nself-check: pass, the selection, records and projection are sound; findings (0) and unrecorded (0) are reported above and not gated\n",
    });
  });

  it("passes a run whose only failures are findings and unrecorded native exceptions, counting both as not gated", () => {
    expect(
      versionTwoSelfCheckOutcomeOf({
        checked: {
          outcome: { code: 1, text: "verdict: fail\n" },
          report: {
            ...EMPTY_RUN_REPORT,
            findings: [NAMED_CLASS_IN_A],
            unrecorded: [IGNORED_IN_A, IGNORED_IN_A],
          },
        },
      }),
    ).toEqual({
      code: 0,
      text: "verdict: fail\nself-check: pass, the selection, records and projection are sound; findings (1) and unrecorded (2) are reported above and not gated\n",
    });
  });

  it("fails naming each gated section that holds an entry, in the order the report lists them", () => {
    expect(
      versionTwoSelfCheckOutcomeOf({
        checked: {
          outcome: { code: 1, text: "verdict: fail\n" },
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
        },
      }),
    ).toEqual({
      code: 1,
      text: "verdict: fail\nself-check: fail, gated sections hold entries: misnamed (1), refused (1), unmeasured (1)\n",
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
