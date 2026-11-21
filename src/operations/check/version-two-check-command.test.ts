import { describe, expect, it, vi } from "vitest";
import { CAST_EXPRESSIONS, ESLINT, REPORT_CATALOGUE } from "../../../tests/report-catalogue.ts";
import type { CommandRequest } from "../../application/ports/command-request.ts";
import type { ExceptionRepositoryOf } from "../../infrastructure/discipline-exceptions-folder/exception-records.ts";
import type { DirectoryPort } from "../../infrastructure/node/file-system/file-system-port.ts";
import type { FileTextPort } from "../../infrastructure/node/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../../infrastructure/git/git-port.ts";
import type { ModuleLoaderPort } from "../../infrastructure/node/modules/module-loader-port.ts";
import { createPathPort } from "../../infrastructure/node/path-port.ts";
import type { ProcessPort } from "../../infrastructure/node/process/process-port.ts";
import type { RecordsReading } from "../../infrastructure/hone-records-folder/hone-record.ts";
import type { RecordsSourceOf } from "../../infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import { DEFAULT_CONVENTIONS } from "../../infrastructure/hone-config-file/conventions.ts";
import type { SettingsReading } from "../../application/run/settings/read-settings.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { EngineRun } from "../../infrastructure/engines/protocol/engine-run/engine-run.ts";
import { versionTwoCheckCommandOf } from "./version-two-check-command.ts";
import type { StagesOver } from "../../version-two-repository.ts";
import type { VersionTwoStages } from "../../application/run/version-two-run.ts";

const FILE_A = repoPathSchema.parse("src/a.ts");

const SETTINGS: SettingsReading = {
  selection: {
    selection: { selected: [], uncovered: [], notAdopted: [], notRun: [], editions: [] },
    bindings: [],
    clauseRoots: [],
    excluded: [],
    eslintConfigRoots: [],
    fileExceptionWhyChains: "required",
  },
  runSettings: { reportOutput: "actionable", assessment: { forfeiture: "this-run" } },
  eslintConfigLookup: { lookup: "detected" },
  conventions: DEFAULT_CONVENTIONS,
  notes: [],
};

const RECORDS: RecordsReading = { records: [], refused: [], notes: [], base: { measured: "yes" } };

const CLEAN_RUN: EngineRun = {
  mechanism: ESLINT,
  hits: [],
  nativeExceptions: [],
  coverableKinds: [],
  projection: "current",
  slices: [],
  unprojectedFolders: [],
  measured: [],
  misnamedRuleIds: [],
};

const FAILING_RUN: EngineRun = {
  ...CLEAN_RUN,
  hits: [{ clause: CAST_EXPRESSIONS, file: FILE_A, anchor: { line: 4, column: 9 }, snippet: "body as Event", check: "claimed-type#cast-expressions" }],
};

const SLICES_RUN: EngineRun = {
  ...CLEAN_RUN,
  slices: [
    { slice: repoPathSchema.parse("packages/a/hone.eslint.mjs"), state: "missing" },
    { slice: repoPathSchema.parse("packages/b/hone.eslint.mjs"), state: "out-of-date" },
  ],
};

const stagesGiving = (request: Partial<VersionTwoStages>): VersionTwoStages => ({
  catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({ outcome: "ok", value: REPORT_CATALOGUE }),
  settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({ outcome: "ok", value: SETTINGS }),
  records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "ok", value: RECORDS }),
  tree: vi.fn<VersionTwoStages["tree"]>().mockReturnValue({ outcome: "ok", value: { tracked: [FILE_A], declaredConfigRoots: [] } }),
  engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "ok", value: [CLEAN_RUN] }),
  projections: vi.fn<VersionTwoStages["projections"]>(),
  touched: vi.fn<VersionTwoStages["touched"]>().mockReturnValue({ measured: "yes", paths: new Set() }),
  ...request,
});

const FAILING_REPORT = `findings (1)
claimed-type#cast-expressions eslint src/a.ts:4:9 body as Event may indicate: declared-not-asserted
symptoms (1)
claimed-type: Claimed type. May indicate: gives a value its type: or needs it narrower → Declared, not asserted. The breach usually sits at the producer. A schema proves the type: an authorised location. Known debt: debt. Read ../install/rules/typescript/symptoms.md#claimed-type
verdict: fail
`;

const INSTALL_ROOT_LINE = "load failure: install-root-unresolvable https://example.com/tool-command.js the text is not a file: URL\n";

const ARGUMENTS_INVALID_LINE = "load failure: arguments-invalid --repo needs a value, as in --repo <dir>\n";

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const ENTRY_URL = "file:///install/src/hone.ts";

const commandWith = (request: { readonly process: ProcessPort; readonly moduleUrl: string }): CommandRequest & { readonly exceptionRepositoryOf: ExceptionRepositoryOf } => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: {
    exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
    read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/repo/package.json", detail: "absent" } }),
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
  moduleUrl: request.moduleUrl,
});

const stagesOverGiving = (request: { readonly stages: VersionTwoStages }) => vi.fn<StagesOver>().mockReturnValue(request.stages);

const ranWith = async (request: { readonly arguments: readonly string[]; readonly stagesOver: StagesOver; readonly moduleUrl: string }) => {
  const processPort = processWith({ arguments: request.arguments });
  await versionTwoCheckCommandOf({
    gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
    directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
    recordsSourceOf: vi.fn<RecordsSourceOf>(),
    stagesOver: request.stagesOver,
  })(commandWith({ process: processPort, moduleUrl: request.moduleUrl }));
  return { writes: vi.mocked(processPort.writeOut).mock.calls, exits: vi.mocked(processPort.exitWith).mock.calls };
};

const FAILING_STAGES = stagesGiving({ engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "ok", value: [FAILING_RUN] }) });

const SETTINGS_ABSENT: RunLoadFailure = { kind: "config-absent", repo: "/repo" };

describe("versionTwoCheckCommandOf", () => {
  it("prints the report's verdict and exits 0 when the run is clean", async () => {
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], stagesOver: stagesOverGiving({ stages: stagesGiving({}) }) });
    expect(ran).toEqual({ writes: [[{ text: "verdict: pass\n" }]], exits: [[{ code: 0 }]] });
  });

  it("prints the findings and the verdict, and exits 1, when the run fails", async () => {
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], stagesOver: stagesOverGiving({ stages: FAILING_STAGES }) });
    expect(ran).toEqual({ writes: [[{ text: FAILING_REPORT }]], exits: [[{ code: 1 }]] });
  });

  it("prints a line for each package file the engine found missing or out of date, and fails, though the root projection is current", async () => {
    const stages = stagesGiving({ engines: vi.fn<VersionTwoStages["engines"]>().mockResolvedValue({ outcome: "ok", value: [SLICES_RUN] }) });
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], stagesOver: stagesOverGiving({ stages }) });
    expect(ran).toEqual({
      writes: [
        [
          {
            text: `projection-problems (2)
eslint missing packages/a/hone.eslint.mjs: that slice is not written; run node /install/src/hone.ts project --repo /repo and commit every file it writes
eslint out-of-date packages/b/hone.eslint.mjs: that slice differs from what hone project writes now; run node /install/src/hone.ts project --repo /repo and commit every file it writes
verdict: fail
`,
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("builds the stages over the repository, the install the command runs from and the base revision given", async () => {
    const stagesOver = stagesOverGiving({ stages: stagesGiving({}) });
    await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo", "--base-revision", "origin/main"], stagesOver });
    expect(stagesOver).toHaveBeenCalledWith(
      expect.objectContaining({ locations: { repoRoot: "/repo", installRoot: "/install", moduleExtension: ".ts", baseRevision: "origin/main" } }),
    );
  });

  it("prints the load failure line and exits 2 when a stage fails", async () => {
    const stages = stagesGiving({ settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({ outcome: "failed", error: SETTINGS_ABSENT }) });
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], stagesOver: stagesOverGiving({ stages }) });
    expect(ran).toEqual({
      writes: [[{ text: "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root\n" }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("prints the upgrade-needed line naming the upgrade command for this repository", async () => {
    const upgrade: RunLoadFailure = { kind: "upgrade-needed", path: "disciplines.json" };
    const stages = stagesGiving({ records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "failed", error: upgrade }) });
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], stagesOver: stagesOverGiving({ stages }) });
    expect(ran).toEqual({
      writes: [[{ text: "load failure: upgrade-needed disciplines.json: this is a version 1 file; run node /install/src/hone.ts upgrade --repo /repo, which rewrites every version 1 file as version 2, and commit what it writes\n" }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("prints the install-root-unresolvable line as it is, and exits 2, when the command was not started from a file", async () => {
    const stagesOver = stagesOverGiving({ stages: stagesGiving({}) });
    const ran = await ranWith({ moduleUrl: "https://example.com/tool-command.js", arguments: ["--repo", "/repo"], stagesOver });
    expect(ran).toEqual({ writes: [[{ text: INSTALL_ROOT_LINE }]], exits: [[{ code: 2 }]] });
    expect(stagesOver).not.toHaveBeenCalled();
  });

  it("prints an arguments-invalid line, exits 2 and builds no stages when the arguments are not readable", async () => {
    const stagesOver = stagesOverGiving({ stages: stagesGiving({}) });
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo"], stagesOver });
    expect(ran).toEqual({ writes: [[{ text: ARGUMENTS_INVALID_LINE }]], exits: [[{ code: 2 }]] });
    expect(stagesOver).not.toHaveBeenCalled();
  });

  it("refuses --report-output failures-only, which version 2 calls actionable, building no stages", async () => {
    const stagesOver = stagesOverGiving({ stages: stagesGiving({}) });
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo", "--report-output", "failures-only"], stagesOver });
    expect(ran).toEqual({
      writes: [[{ text: 'load failure: arguments-invalid --report-output takes full, actionable, counts or verdict-only, not "failures-only"\n' }]],
      exits: [[{ code: 2 }]],
    });
    expect(stagesOver).not.toHaveBeenCalled();
  });
});
