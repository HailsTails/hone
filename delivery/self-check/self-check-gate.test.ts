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
import type { Finding } from "../../src/domain/finding/governance.ts";
import type {
  Case,
  Principle,
  RecordKind,
  Rule,
  Symptom,
} from "../../src/domain/language-layer/symptom-catalogue.ts";
import type { CheckReport } from "../../src/domain/report/check-report.ts";
import type { RunReport } from "../../src/domain/report/run-report.ts";
import { repoPathOf } from "../../src/domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../src/domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../src/domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../src/domain/rule-set/discipline-id-of.ts";
import { createDefaultEnginePort } from "../../src/infrastructure/engines/protocol/engine-port.ts";
import {
  NO_SYMPTOM_GUIDE,
  type SymptomGuide,
} from "../../src/infrastructure/printed-report/symptoms/symptom-notes.ts";
import {
  runSelfCheck,
  selfCheckOutcomeOf,
  VERSION_TWO_GATED_SECTIONS,
  versionTwoSelfCheckOutcomeOf,
} from "./self-check-gate.ts";

const PROJECT_COMMAND = "node src/hone.ts project --repo .";

const PRUNE_COMMAND = "node src/hone.ts prune-debt --repo .";

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

const CLASS_IN_A: Finding = {
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-14"),
    clause: clauseIdOf("class-syntax"),
  },
  file: repoPathOf("src/a.ts"),
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
  mechanism: "walker",
};

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const DOER_OR_ORCHESTRATOR: Rule = {
  name: "doer-or-orchestrator",
  title: "Doer or orchestrator",
  principle: ONE_PLACE_DECIDES,
  standing: "accepted",
};

const KEEPS_STATE: Case = {
  name: "keeps-state-or-settings-across-calls",
  title: "Keeps state or settings across calls",
  standing: "accepted",
  owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }],
};

const DEBT: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const CLASS_DECLARED: Symptom = {
  name: "class-declared",
  title: "Class declared",
  seen: "A class declaration.",
  mayIndicate: [{ case: KEEPS_STATE, points: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] }],
  breachUsuallySits: "in the unit that holds state",
  recipes: [],
  correctUses: [],
};

const CLASS_GUIDE: SymptomGuide = {
  guide: "catalogue",
  page: "node_modules/@hailstails/hone/rules/typescript/symptoms.md",
  catalogue: {
    principles: [ONE_PLACE_DECIDES],
    rules: [DOER_OR_ORCHESTRATOR],
    cases: [KEEPS_STATE],
    recipes: [],
    recordKinds: [AUTHORISED_LOCATION, DEBT],
    alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
    engines: [],
    symptoms: [CLASS_DECLARED],
    clauses: [
      {
        clause: {
          ruleSet: TOOL_RULE_SET,
          discipline: disciplineIdOf("CD-14"),
          clause: clauseIdOf("class-syntax"),
        },
        sight: { kind: "one-symptom", symptom: CLASS_DECLARED },
      },
    ],
    checks: [],
    namedBans: [],
  },
};

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

const IGNORED_IN_A = {
  kind: "ignore",
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-14"),
    clause: clauseIdOf("class-syntax"),
  },
  file: repoPathOf("src/a.ts"),
  mechanism: "eslint",
} as const;

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
            findings: [CLASS_IN_A],
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
            findings: [CLASS_IN_A],
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

describe("selfCheckOutcomeOf", () => {
  it("passes a clean run, printing the report and the gate line", () => {
    expect(
      selfCheckOutcomeOf({
        result: {
          outcome: "ok",
          value: {
            report: EMPTY_REPORT,
            output: "full",
            projectCommand: PROJECT_COMMAND,
            pruneCommand: PRUNE_COMMAND,
            guide: NO_SYMPTOM_GUIDE,
          },
        },
      }),
    ).toEqual({
      code: 0,
      text: "verdict: pass\nself-check: pass, the selection, records and projection are sound; findings (0) and unrecorded (0) are reported above and not gated\n",
    });
  });

  it("passes a run whose only failures are findings, printing them in full as not gated", () => {
    expect(
      selfCheckOutcomeOf({
        result: {
          outcome: "ok",
          value: {
            report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] },
            output: "full",
            projectCommand: PROJECT_COMMAND,
            pruneCommand: PRUNE_COMMAND,
            guide: NO_SYMPTOM_GUIDE,
          },
        },
      }),
    ).toEqual({
      code: 0,
      text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nverdict: fail\nself-check: pass, the selection, records and projection are sound; findings (1) and unrecorded (0) are reported above and not gated\n",
    });
  });

  it("fails naming each gated section that holds an entry", () => {
    expect(
      selfCheckOutcomeOf({
        result: {
          outcome: "ok",
          value: {
            report: {
              ...EMPTY_REPORT,
              findings: [CLASS_IN_A],
              uncovered: [
                {
                  ruleSet: TOOL_RULE_SET,
                  discipline: disciplineIdOf("CD-15"),
                  clause: clauseIdOf("loops"),
                },
              ],
              unmeasured: [{ kind: "import-unmeasured", base: { state: "not-given" } }],
            },
            output: "counts",
            projectCommand: PROJECT_COMMAND,
            pruneCommand: PRUNE_COMMAND,
            guide: NO_SYMPTOM_GUIDE,
          },
        },
      }),
    ).toEqual({
      code: 1,
      text: "findings (1)\nuncovered (1)\nunmeasured (1)\nverdict: fail\nself-check: fail, gated sections hold entries: uncovered (1), unmeasured (1)\n",
    });
  });

  it("names each finding's symptom from the guide, with the symptom's note in readFirst", () => {
    expect(
      selfCheckOutcomeOf({
        result: {
          outcome: "ok",
          value: {
            report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] },
            output: "full",
            projectCommand: PROJECT_COMMAND,
            pruneCommand: PRUNE_COMMAND,
            guide: CLASS_GUIDE,
          },
        },
      }),
    ).toEqual({
      code: 0,
      text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {} symptom: class-declared, may indicate: doer-or-orchestrator\nreadFirst (1)\nclass-declared: Class declared. May indicate: keeps state or settings across calls → Doer or orchestrator. The breach usually sits in the unit that holds state. Known debt: debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#class-declared\nverdict: fail\nself-check: pass, the selection, records and projection are sound; findings (1) and unrecorded (0) are reported above and not gated\n",
    });
  });

  it("exits 2 with the load failure when the check cannot load", () => {
    expect(
      selfCheckOutcomeOf({
        result: {
          outcome: "failed",
          error: { kind: "arguments-invalid", detail: "--repo is required" },
        },
      }),
    ).toEqual({
      code: 2,
      text: "load failure: arguments-invalid --repo is required\n",
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
  engine: createDefaultEnginePort({}),
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
