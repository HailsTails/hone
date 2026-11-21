import { describe, expect, it, vi } from "vitest";
import { ESLINT_ENGINE, REPORT_CATALOGUE } from "../../../tests/report-catalogue.ts";
import type { DirectoryPort } from "../../infrastructure/node/file-system/file-system-port.ts";
import type { FileTextPort } from "../../infrastructure/node/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../../infrastructure/git/git-port.ts";
import type { ModuleLoaderPort } from "../../infrastructure/node/modules/module-loader-port.ts";
import { createPathPort } from "../../infrastructure/node/path-port.ts";
import type { ProcessPort } from "../../infrastructure/node/process/process-port.ts";
import type { ProjectedFile } from "../../infrastructure/engines/protocol/checks/checks-runner-types.ts";
import type { RecordsReading } from "../../infrastructure/hone-records-folder/hone-record.ts";
import type { RecordsSourceOf } from "../../infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import { DEFAULT_CONVENTIONS } from "../../infrastructure/hone-config-file/conventions.ts";
import type { SettingsReading } from "../../application/run/settings/read-settings.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { VersionedHandler } from "../../infrastructure/command-line/run-path/version-chosen-command.ts";
import { versionTwoProjectCommandOf } from "./version-two-project-command.ts";
import type { StagesOver } from "../../version-two-repository.ts";
import type { VersionTwoStages } from "../../application/run/version-two-run.ts";

type Command = Parameters<VersionedHandler>[0];

const FILE: ProjectedFile = { file: repoPathSchema.parse("hone.eslint.mjs"), text: "export default [];\n" };

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

const stagesProjecting = (request: { readonly projected: Awaited<ReturnType<VersionTwoStages["projections"]>> }): VersionTwoStages => ({
  catalogue: vi.fn<VersionTwoStages["catalogue"]>().mockReturnValue({ outcome: "ok", value: REPORT_CATALOGUE }),
  settings: vi.fn<VersionTwoStages["settings"]>().mockReturnValue({ outcome: "ok", value: SETTINGS }),
  records: vi.fn<VersionTwoStages["records"]>().mockReturnValue({ outcome: "ok", value: RECORDS }),
  tree: vi.fn<VersionTwoStages["tree"]>().mockReturnValue({ outcome: "ok", value: { tracked: [], declaredConfigRoots: [] } }),
  engines: vi.fn<VersionTwoStages["engines"]>(),
  projections: vi.fn<VersionTwoStages["projections"]>().mockResolvedValue(request.projected),
  touched: vi.fn<VersionTwoStages["touched"]>(),
});

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const ENTRY_URL = "file:///install/src/hone.ts";

const fileTextAbsent = (): FileTextPort => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
  read: vi.fn<FileTextPort["read"]>(),
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const fileTextHolding = (request: { readonly current: string }): FileTextPort => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.current }),
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const commandWith = (request: { readonly process: ProcessPort; readonly moduleUrl: string; readonly fileText: FileTextPort }): Command => ({
  process: request.process,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: request.fileText,
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
    changedSince: vi.fn<GitPort["changedSince"]>(),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
    renamedSince: vi.fn<GitPort["renamedSince"]>(),
  },
  moduleUrl: request.moduleUrl,
});

const ranWith = async (request: { readonly arguments: readonly string[]; readonly stagesOver: StagesOver; readonly moduleUrl: string; readonly fileText: FileTextPort }) => {
  const processPort = processWith({ arguments: request.arguments });
  const { fileText } = request;
  await versionTwoProjectCommandOf({
    gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
    directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
    recordsSourceOf: vi.fn<RecordsSourceOf>(),
    stagesOver: request.stagesOver,
  })(commandWith({ process: processPort, moduleUrl: request.moduleUrl, fileText }));
  return { writes: vi.mocked(processPort.writeOut).mock.calls, exits: vi.mocked(processPort.exitWith).mock.calls };
};

const stagesOverProjecting = (request: { readonly projected: Awaited<ReturnType<VersionTwoStages["projections"]>> }) =>
  vi.fn<StagesOver>().mockReturnValue(stagesProjecting(request));

describe("versionTwoProjectCommandOf", () => {
  it("writes each file the engines project into the repository, prints it as written, and exits 0", async () => {
    const fileText = fileTextAbsent();
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText, stagesOver: stagesOverProjecting({ projected: { outcome: "ok", value: [FILE] } }) });
    expect({ ran, written: vi.mocked(fileText.write).mock.calls }).toEqual({
      ran: { writes: [[{ text: "hone.eslint.mjs written\n" }]], exits: [[{ code: 0 }]] },
      written: [[{ path: "/repo/hone.eslint.mjs", text: "export default [];\n" }]],
    });
  });

  it("prints a file already holding the projected text as unchanged, and writes nothing", async () => {
    const fileText = fileTextHolding({ current: "export default [];\n" });
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText, stagesOver: stagesOverProjecting({ projected: { outcome: "ok", value: [FILE] } }) });
    expect({ ran, written: vi.mocked(fileText.write).mock.calls }).toEqual({
      ran: { writes: [[{ text: "hone.eslint.mjs unchanged\n" }]], exits: [[{ code: 0 }]] },
      written: [],
    });
  });

  it("prints the file-unwritable line and exits 2 when a file cannot be written", async () => {
    const fileText: FileTextPort = {
      ...fileTextAbsent(),
      write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "failed", error: { kind: "unwritable", path: "/repo/hone.eslint.mjs", detail: "ENOSPC" } }),
    };
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText, stagesOver: stagesOverProjecting({ projected: { outcome: "ok", value: [FILE] } }) });
    expect(ran).toEqual({ writes: [[{ text: "load failure: file-unwritable /repo/hone.eslint.mjs ENOSPC\n" }]], exits: [[{ code: 2 }]] });
  });

  it("prints nothing and exits 0 when no engine has a file to project", async () => {
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText: fileTextAbsent(), stagesOver: stagesOverProjecting({ projected: { outcome: "ok", value: [] } }) });
    expect(ran).toEqual({ writes: [[{ text: "" }]], exits: [[{ code: 0 }]] });
  });

  it("builds the stages over the repository and the install the command runs from, with no base revision", async () => {
    const stagesOver = stagesOverProjecting({ projected: { outcome: "ok", value: [] } });
    await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText: fileTextAbsent(), stagesOver });
    expect(stagesOver).toHaveBeenCalledWith(expect.objectContaining({ locations: { repoRoot: "/repo", installRoot: "/install", moduleExtension: ".ts", baseRevision: undefined } }));
  });

  it("prints the not-ready-yet line and exits 2 when the engine's config roots are not ready", async () => {
    const notReady: RunLoadFailure = { kind: "not-ready-yet", what: { thing: "eslint-config-roots", paths: ["packages/web"] } };
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText: fileTextAbsent(), stagesOver: stagesOverProjecting({ projected: { outcome: "failed", error: notReady } }) });
    expect(ran).toEqual({
      writes: [[{ text: "load failure: not-ready-yet eslint-config-roots: this release does not run a repository that holds other version 2 repositories yet; folders holding hone.config.json: packages/web; move them out of this repository, and run each on its own with --repo\n" }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("prints the failure of the engine's runner and exits 2", async () => {
    const failed: RunLoadFailure = { kind: "engine-failed", engine: { named: "engine", engine: ESLINT_ENGINE }, failure: { kind: "tool-failed", detail: "disk full" } };
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo", "/repo"], fileText: fileTextAbsent(), stagesOver: stagesOverProjecting({ projected: { outcome: "failed", error: failed } }) });
    expect(ran).toEqual({ writes: [[{ text: "load failure: engine-failed eslint tool-failed disk full\n" }]], exits: [[{ code: 2 }]] });
  });

  it("prints the install-root-unresolvable line as it is, and exits 2, building no stages, when the command was not started from a file", async () => {
    const stagesOver = stagesOverProjecting({ projected: { outcome: "ok", value: [] } });
    const ran = await ranWith({ moduleUrl: "https://example.com/tool-command.js", arguments: ["--repo", "/repo"], fileText: fileTextAbsent(), stagesOver });
    expect(ran).toEqual({ writes: [[{ text: "load failure: install-root-unresolvable https://example.com/tool-command.js the text is not a file: URL\n" }]], exits: [[{ code: 2 }]] });
    expect(stagesOver).not.toHaveBeenCalled();
  });

  it("prints an arguments-invalid line, exits 2 and builds no stages when the arguments are not readable", async () => {
    const stagesOver = stagesOverProjecting({ projected: { outcome: "ok", value: [] } });
    const ran = await ranWith({ moduleUrl: ENTRY_URL, arguments: ["--repo"], fileText: fileTextAbsent(), stagesOver });
    expect(ran).toEqual({ writes: [[{ text: "load failure: arguments-invalid --repo needs a value, as in --repo <dir>\n" }]], exits: [[{ code: 2 }]] });
    expect(stagesOver).not.toHaveBeenCalled();
  });
});
