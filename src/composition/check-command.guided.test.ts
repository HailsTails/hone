import { describe, expect, it, vi } from "vitest";
import type { ExceptionRepositoryOf } from "../application/ports/records/exception-repository.ts";
import type { ExceptionEntryParser } from "../application/ports/records/exception-entries.ts";
import type { SelectionRepositoryOf } from "../application/ports/selection/selection-repository.ts";
import type { ShownPathOfRepository } from "../application/ports/installation/shown-path-of.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import type { RecordKind } from "../domain/language-layer/symptom-catalogue.ts";
import type { CheckReport } from "../domain/report/check-report.ts";
import type { SymptomGuide } from "../infrastructure/printed-report/symptoms/symptom-notes.ts";
import type { VersionOneCommandPorts } from "../application/ports/version-one-command-request.ts";
import type { CheckArguments } from "../application/ports/command/command-arguments.ts";
import type { ReportOutput } from "../domain/settings/report-output.ts";
import { type CheckRunAt, guidedCheckRunFor } from "./check-command.ts";
import type { SymptomGuideIn } from "../infrastructure/printed-report/symptoms/symptom-guide.ts";
import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";

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

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const GUIDE: SymptomGuide = {
  guide: "catalogue",
  catalogue: {
    principles: [],
    rules: [],
    cases: [],
    recipes: [],
    recordKinds: [AUTHORISED_LOCATION, DEBT],
    alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
    engines: [],
    symptoms: [],
    clauses: [],
    checks: [],
    namedBans: [],
  },
  page: "node_modules/@hailstails/hone/rules/typescript/symptoms.md",
};

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const FILE_TEXT: FileTextPort = {
  read: vi.fn<FileTextPort["read"]>(),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
};

const MODULES: ModuleLoaderPort = { load: vi.fn<ModuleLoaderPort["load"]>() };

const ENGINE = createDefaultEnginePort({});

const GIT: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
};

const EXCEPTION_REPOSITORY_OF = vi.fn<ExceptionRepositoryOf>();

const EXCEPTION_ENTRY_PARSER: ExceptionEntryParser = {
  parseExceptionEntries: vi.fn<ExceptionEntryParser["parseExceptionEntries"]>(),
  importedEntriesIn: vi.fn<ExceptionEntryParser["importedEntriesIn"]>(),
  importSourcesOf: vi.fn<ExceptionEntryParser["importSourcesOf"]>(),
};

const SELECTION_REPOSITORY_OF = vi.fn<SelectionRepositoryOf>();

const SHOWN_PATH_OF_REPOSITORY = vi.fn<ShownPathOfRepository>();

const MODULE_URL = "file:///repo/node_modules/@hailstails/hone/src/hone.ts";

const ARGUMENTS: CheckArguments<ReportOutput> = { repo: "/repo", baseRevision: undefined, reportOutput: undefined, forfeiture: undefined };

const COMMAND: VersionOneCommandPorts = {
  path: PATH,
  fileText: FILE_TEXT,
  engine: ENGINE,
  modules: MODULES,
  git: GIT,
  exceptionRepositoryOf: EXCEPTION_REPOSITORY_OF,
  exceptionEntryParser: EXCEPTION_ENTRY_PARSER,
  selectionRepositoryOf: SELECTION_REPOSITORY_OF,
  shownPathOfRepository: SHOWN_PATH_OF_REPOSITORY,
  moduleUrl: MODULE_URL,
};

const ABSENT_SELECTION_COMMAND: VersionOneCommandPorts = {
  path: PATH,
  fileText: {
    read: vi.fn<FileTextPort["read"]>(),
    exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
    write: vi.fn<FileTextPort["write"]>(),
  },
  engine: ENGINE,
  modules: MODULES,
  git: GIT,
  exceptionRepositoryOf: EXCEPTION_REPOSITORY_OF,
  exceptionEntryParser: EXCEPTION_ENTRY_PARSER,
  selectionRepositoryOf: SELECTION_REPOSITORY_OF,
  shownPathOfRepository: SHOWN_PATH_OF_REPOSITORY,
  moduleUrl: MODULE_URL,
};

describe("guidedCheckRunFor", () => {
  it("gives the check run with the symptom guide beside it", async () => {
    expect(
      await guidedCheckRunFor({
        ports: COMMAND,
        arguments: ARGUMENTS,
        checkRunAt: vi.fn<CheckRunAt>().mockResolvedValue({
          outcome: "ok",
          value: { report: EMPTY_REPORT, output: "full", projectCommand: "hone project --repo .", pruneCommand: "hone prune-debt --repo ." },
        }),
        symptomGuideIn: vi.fn<SymptomGuideIn>().mockReturnValue(GUIDE),
      }),
    ).toEqual({
      outcome: "ok",
      value: { report: EMPTY_REPORT, output: "full", projectCommand: "hone project --repo .", pruneCommand: "hone prune-debt --repo .", guide: GUIDE },
    });
  });

  it("hands the check its ports and the locations it resolved, and the guide the same roots", async () => {
    const checkRunAt = vi.fn<CheckRunAt>().mockResolvedValue({
      outcome: "ok",
      value: { report: EMPTY_REPORT, output: "full", projectCommand: "hone project --repo .", pruneCommand: "hone prune-debt --repo ." },
    });
    const symptomGuideIn = vi.fn<SymptomGuideIn>().mockReturnValue(GUIDE);

    await guidedCheckRunFor({ ports: COMMAND, arguments: ARGUMENTS, checkRunAt, symptomGuideIn });

    expect(checkRunAt).toHaveBeenCalledExactlyOnceWith({
      path: PATH,
      fileText: FILE_TEXT,
      engine: ENGINE,
      modules: MODULES,
      git: GIT,
      exceptionRepositoryOf: EXCEPTION_REPOSITORY_OF,
      exceptionEntryParser: EXCEPTION_ENTRY_PARSER,
      selectionRepositoryOf: SELECTION_REPOSITORY_OF,
      shownPathOfRepository: SHOWN_PATH_OF_REPOSITORY,
      moduleUrl: MODULE_URL,
      locations: {
        arguments: { repo: "/repo", baseRevision: undefined, reportOutput: undefined, forfeiture: undefined },
        repoRoot: "/repo",
        installRoot: "/repo/node_modules/@hailstails/hone",
      },
    });
    expect(symptomGuideIn).toHaveBeenCalledExactlyOnceWith({
      path: PATH,
      fileText: FILE_TEXT,
      repoRoot: "/repo",
      installRoot: "/repo/node_modules/@hailstails/hone",
    });
  });

  it("gives the check's load failure", async () => {
    expect(
      await guidedCheckRunFor({
        ports: COMMAND,
        arguments: ARGUMENTS,
        checkRunAt: vi.fn<CheckRunAt>().mockResolvedValue({ outcome: "failed", error: { kind: "git-failed", detail: "not a git repository" } }),
        symptomGuideIn: vi.fn<SymptomGuideIn>().mockReturnValue(GUIDE),
      }),
    ).toEqual({ outcome: "failed", error: { kind: "git-failed", detail: "not a git repository" } });
  });

  it("does not read the guide when the check fails", async () => {
    const symptomGuideIn = vi.fn<SymptomGuideIn>().mockReturnValue(GUIDE);

    await guidedCheckRunFor({
      ports: COMMAND,
      arguments: ARGUMENTS,
      checkRunAt: vi.fn<CheckRunAt>().mockResolvedValue({ outcome: "failed", error: { kind: "git-failed", detail: "not a git repository" } }),
      symptomGuideIn,
    });

    expect(symptomGuideIn).not.toHaveBeenCalled();
  });

  it("gives the failure to locate the check, running neither the check nor the guide", async () => {
    const checkRunAt = vi.fn<CheckRunAt>().mockResolvedValue({
      outcome: "ok",
      value: { report: EMPTY_REPORT, output: "full", projectCommand: "hone project --repo .", pruneCommand: "hone prune-debt --repo ." },
    });
    const symptomGuideIn = vi.fn<SymptomGuideIn>().mockReturnValue(GUIDE);

    expect(await guidedCheckRunFor({ ports: ABSENT_SELECTION_COMMAND, arguments: ARGUMENTS, checkRunAt, symptomGuideIn })).toEqual({
      outcome: "failed",
      error: { kind: "selection-absent", repo: "/repo" },
    });
    expect(checkRunAt).not.toHaveBeenCalled();
    expect(symptomGuideIn).not.toHaveBeenCalled();
  });
});
