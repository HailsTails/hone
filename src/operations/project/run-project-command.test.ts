import { describe, expect, it, vi } from "vitest";
import { singleFileRepositoriesOver } from "../../../tests/records-disk.ts";
import { ABSENT_FILE, type FakeFile, presentFile, presentJsonFile } from "../../../tests/fake-file.ts";
import { requiredEntry } from "../../../tests/required-entry.ts";
import type { LoadedRunner } from "../../infrastructure/engines/protocol/runner-module/runner-module-schema.ts";
import type { FileTextPort } from "../../infrastructure/node/file-system/file-text-port.ts";
import type { GitPort } from "../../infrastructure/git/git-port.ts";
import type { ModuleLoaderPort } from "../../infrastructure/node/modules/module-loader-port.ts";
import { createPathPort, type PathPort } from "../../infrastructure/node/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import type { ProcessPort } from "../../infrastructure/node/process/process-port.ts";
import { type RepoPath, repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { Result } from "../../domain/result.ts";
import type { VersionOneCommandRequest } from "../../application/ports/version-one-command-request.ts";
import { runProjectCommand } from "./run-project-command.ts";

const ENTRY_URL = "file:///install/src/hone.ts";
const NOT_A_FILE_URL = "https://example.invalid/src/hone.ts";

const CLASS_SYNTAX_DEFINITION = {
  kind: "mechanical",
  id: "class-syntax",
  summary: "no class syntax",
  mechanisms: ["audit"],
  anchor: { kind: "keyword", keyword: "class" },
  cases: {
    flag: [{ name: "flagged", fileName: "src/a.ts", source: "class A {}\n", expectedLines: [1] }],
    allow: [{ name: "allowed", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
  },
};

const NOTHING_SELECTED: Readonly<Record<string, FakeFile>> = {
  "/repo/disciplines.json": presentJsonFile({ document: { version: 1, ruleSets: {}, clauses: {} } }),
  "/repo/discipline-exceptions.json": ABSENT_FILE,
  "/install/package.json": ABSENT_FILE,
};

const CLASS_SYNTAX_SELECTED: Readonly<Record<string, FakeFile>> = {
  "/repo/disciplines.json": presentJsonFile({ document: { version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "audit" } } }),
  "/repo/discipline-exceptions.json": ABSENT_FILE,
  "/install/rules/CD-14/discipline.json": presentJsonFile({ document: { version: 1, id: "CD-14", clauses: [CLASS_SYNTAX_DEFINITION] } }),
  "/install/src/infrastructure/engines/audit/CD-14/piece.json": presentJsonFile({
    document: { version: 1, discipline: "CD-14", mechanism: "audit", clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" } }] },
  }),
  "/install/src/infrastructure/engines/audit/runner/runner.ts": presentFile({ text: "export const runner = {};\n" }),
  "/repo/src/a.ts": presentFile({ text: "class A {}\n" }),
};

const fileTextOver = (files: Readonly<Record<string, FakeFile>>): FileTextPort => ({
  read: ({ path }) => files[path].read,
  exists: ({ path }) => files[path].presence,
  write: vi.fn<FileTextPort["write"]>(),
});

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const DIRECTORIES: Readonly<Record<string, string>> = {
  "/install/src/hone.ts": "/install/src",
  "/install/src": "/install",
};

type FileUrlResult = Result<
  AbsolutePath,
  { readonly kind: "not-a-file-url"; readonly url: string; readonly detail: string }
>;

const FILE_URLS: Readonly<Record<string, FileUrlResult>> = {
  [ENTRY_URL]: { outcome: "ok", value: absolutePathSchema.parse("/install/src/hone.ts") },
  [NOT_A_FILE_URL]: {
    outcome: "failed",
    error: { kind: "not-a-file-url", url: NOT_A_FILE_URL, detail: "the text is not a file: URL" },
  },
};

const TABLE_PATH: PathPort = {
  ...POSIX_PATH,
  relative: vi.fn<PathPort["relative"]>().mockReturnValue({ relation: "different-root" }),
  directoryOf: ({ path }) => requiredEntry({ table: DIRECTORIES, key: path }),
  fromFileUrl: ({ url }) => requiredEntry({ table: FILE_URLS, key: url }),
};

const REPO_RESOLVING_TO_NO_ABSOLUTE_PATH: PathPort = {
  ...TABLE_PATH,
  resolve: ({ path }) => ({ outcome: "failed", error: { kind: "working-directory-unusable", path } }),
};

const standaloneRunner = (request: { readonly runReturns: unknown }): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>().mockResolvedValue(request.runReturns),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const modulesLoading = (module: unknown): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: module }),
});

const gitTracking = (paths: readonly RepoPath[]): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: paths }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const commandRequest = (overrides: Partial<VersionOneCommandRequest>): VersionOneCommandRequest => {
  const ports = {
    process: processWith({ arguments: ["--repo", "/repo"] }),
    path: TABLE_PATH,
    fileText: fileTextOver(NOTHING_SELECTED),
    modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [] } }) }),
    git: gitTracking([]),
    moduleUrl: ENTRY_URL,
    ...overrides,
  };
  return { exceptionRepositoryOf: singleFileRepositoriesOver(ports), ...ports };
};

const outputOf = (request: { readonly process: ProcessPort }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

describe("runProjectCommand", () => {
  it("exits 2 with the arguments-invalid line when an argument is unknown", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo", "--base-revision", "main"] });

    await runProjectCommand(commandRequest({ process: processPort }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid /) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the install-root-unresolvable line when its module URL is not a file URL", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runProjectCommand(commandRequest({ process: processPort, moduleUrl: NOT_A_FILE_URL }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [
        [{ text: expect.stringMatching(/^load failure: install-root-unresolvable https:\/\/example\.invalid\//) }],
      ],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the arguments-invalid line when --repo resolves to no absolute path", async () => {
    const processPort = processWith({ arguments: ["--repo", "relative-repo"] });

    await runProjectCommand(commandRequest({ process: processPort, path: REPO_RESOLVING_TO_NO_ABSOLUTE_PATH }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid /) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the selection-absent line when --repo holds no disciplines.json", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runProjectCommand(
      commandRequest({ process: processPort, fileText: fileTextOver({ ...NOTHING_SELECTED, "/repo/disciplines.json": ABSENT_FILE }) }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [
        [{ text: "load failure: selection-absent /repo holds no disciplines.json; give the folder that holds it, usually the repository root\n" }],
      ],
      exits: [[{ code: 2 }]],
    });
  });

  it("names a file inside --repo relative to it in the load failure line", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runProjectCommand(
      commandRequest({
        process: processPort,
        path: { ...TABLE_PATH, relative: () => ({ relation: "within-root", path: "disciplines.json" }) },
        fileText: fileTextOver({ ...NOTHING_SELECTED, "/repo/disciplines.json": presentFile({ text: "{" }) }),
      }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: file-malformed disciplines\.json /) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the load failure line when the selection cannot be loaded", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runProjectCommand(
      commandRequest({
        process: processPort,
        fileText: fileTextOver({ ...NOTHING_SELECTED, "/repo/disciplines.json": presentFile({ text: "{" }) }),
      }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: file-malformed \/repo\/disciplines\.json /) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 0 printing no projection line when every selected runner is standalone", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runProjectCommand(
      commandRequest({ process: processPort, fileText: fileTextOver(CLASS_SYNTAX_SELECTED), git: gitTracking([repoPathSchema.parse("src/a.ts")]) }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("loads the runner from the install two levels above the entry file", async () => {
    const modules = modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [] } }) });

    await runProjectCommand(commandRequest({ fileText: fileTextOver(CLASS_SYNTAX_SELECTED), modules }));

    expect(vi.mocked(modules.load).mock.calls).toEqual([
      [{ path: "/install/src/infrastructure/engines/audit/runner/runner.ts" }],
    ]);
  });

  it("exits 2 with the arguments-invalid line when both --repo and the install root are unresolvable", async () => {
    const processPort = processWith({ arguments: ["--repo", "relative-repo"] });

    await runProjectCommand(
      commandRequest({ process: processPort, path: REPO_RESOLVING_TO_NO_ABSOLUTE_PATH, moduleUrl: NOT_A_FILE_URL }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid /) }]],
      exits: [[{ code: 2 }]],
    });
  });
});
