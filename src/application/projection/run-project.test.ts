import { assert, describe, expect, it, vi } from "vitest";
import { createExceptionRepository, type ExceptionLayoutPorts } from "../../infrastructure/discipline-exceptions-folder/exception-layout.ts";
import type { ExceptionRepository } from "../../infrastructure/discipline-exceptions-folder/exception-records.ts";
import type { LegacyWhyChain } from "../../infrastructure/discipline-exceptions-folder/version-one-why-chain.ts";
import type { LoadedRunner } from "../../infrastructure/engines/protocol/runner-module/runner-module-schema.ts";
import type { DirectoryEntry } from "../../infrastructure/node/file-system/file-system-port.ts";
import type { FileTextPort } from "../../infrastructure/node/file-system/file-text-port.ts";
import type { GitPort } from "../../infrastructure/git/git-port.ts";
import type { ModuleLoaderPort } from "../../infrastructure/node/modules/module-loader-port.ts";
import { createPathPort, type PathPort } from "../../infrastructure/node/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { Result } from "../../domain/result.ts";
import { type ProjectRequest, runProject } from "./run-project.ts";

const SELECTION_PATH = "/repo/disciplines.json";
const EXCEPTIONS_PATH = "/repo/discipline-exceptions.json";
const DISCIPLINE_PATH = "/install/rules/CD-14/discipline.json";
const PIECE_PATH = "/install/src/infrastructure/engines/audit/CD-14/piece.json";
const RUNNER_PATH = "/install/src/infrastructure/engines/audit/runner/runner.ts";
const LINT_PIECE_PATH = "/install/src/infrastructure/engines/lint/CD-14/piece.json";
const LINT_RUNNER_PATH = "/install/src/infrastructure/engines/lint/runner/runner.ts";

type FakeFile = {
  readonly read: Result<string, { readonly kind: "unreadable"; readonly path: string; readonly detail: string }>;
  readonly presence: "present" | "absent";
};

const presentFile = (request: { readonly text: string }): FakeFile => ({
  read: { outcome: "ok", value: request.text },
  presence: "present",
});

const ABSENT_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } },
  presence: "absent",
};

const fileTextOver = (files: Readonly<Record<string, FakeFile>>): FileTextPort => ({
  read: ({ path }) => files[path].read,
  exists: ({ path }) => files[path].presence,
  write: vi.fn<FileTextPort["write"]>(),
});

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/repo","disciplines.json"]': SELECTION_PATH,
  '["/repo","discipline-exceptions.json"]': EXCEPTIONS_PATH,
  '["/repo","discipline-exceptions"]': "/repo/discipline-exceptions",
  '["/repo","src/a.ts"]': "/repo/src/a.ts",
  '["/repo","packages/a/eslint.config.mjs"]': "/repo/packages/a/eslint.config.mjs",
  '["/install","rules","CD-14","discipline.json"]': DISCIPLINE_PATH,
  '["/install","src","infrastructure","engines","audit","CD-14","piece.json"]': PIECE_PATH,
  '["/install","src","infrastructure","engines","audit","CD-14"]': "/install/src/infrastructure/engines/audit/CD-14",
  '["/install","src","infrastructure","engines","audit","runner","runner.ts"]': RUNNER_PATH,
  '["/install","src","infrastructure","engines","lint","CD-14","piece.json"]': LINT_PIECE_PATH,
  '["/install","src","infrastructure","engines","lint","CD-14"]': "/install/src/infrastructure/engines/lint/CD-14",
  '["/install","src","infrastructure","engines","lint","runner","runner.ts"]': LINT_RUNNER_PATH,
};

const DIRECTORIES: Readonly<Record<string, string>> = {
  [PIECE_PATH]: "/install/src/infrastructure/engines/audit/CD-14",
  [DISCIPLINE_PATH]: "/install/rules/CD-14",
  [RUNNER_PATH]: "/install/src/infrastructure/engines/audit/runner",
  [LINT_PIECE_PATH]: "/install/src/infrastructure/engines/lint/CD-14",
  [LINT_RUNNER_PATH]: "/install/src/infrastructure/engines/lint/runner",
};

const TABLE_PATH: PathPort = {
  join: ({ segments }) => requiredEntry({ table: JOINED_PATHS, key: JSON.stringify(segments) }),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: ({ path }) => requiredEntry({ table: DIRECTORIES, key: path }),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: ({ path }) => ({ outcome: "ok", value: absolutePathSchema.parse(path) }),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const DISCIPLINE = JSON.stringify({
  version: 1,
  id: "CD-14",
  clauses: [
    {
      kind: "mechanical",
      id: "class-syntax",
      summary: "no class syntax",
      mechanisms: ["audit"],
      anchor: { kind: "keyword", keyword: "class" },
      cases: {
        flag: [{ name: "flagged", fileName: "src/a.ts", source: "class A {}\n", expectedLines: [1] }],
        allow: [{ name: "allowed", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
      },
    },
  ],
});

const PIECE = JSON.stringify({
  version: 1,
  discipline: "CD-14",
  mechanism: "audit",
  clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" } }],
});

const INSTALL: Readonly<Record<string, FakeFile>> = {
  [SELECTION_PATH]: presentFile({
    text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "audit" } }),
  }),
  [EXCEPTIONS_PATH]: ABSENT_FILE,
  [DISCIPLINE_PATH]: presentFile({ text: DISCIPLINE }),
  [PIECE_PATH]: presentFile({ text: PIECE }),
  [RUNNER_PATH]: presentFile({ text: "export const runner = {};\n" }),
  "/repo/src/a.ts": presentFile({ text: "class A {}\n" }),
};

const TWO_MECHANISM_DISCIPLINE = JSON.stringify({
  version: 1,
  id: "CD-14",
  clauses: [
    {
      kind: "mechanical",
      id: "class-syntax",
      summary: "no class syntax",
      mechanisms: ["audit"],
      anchor: { kind: "keyword", keyword: "class" },
      cases: {
        flag: [{ name: "flagged", fileName: "src/a.ts", source: "class A {}\n", expectedLines: [1] }],
        allow: [{ name: "allowed", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
      },
    },
    {
      kind: "mechanical",
      id: "abstract-syntax",
      summary: "no abstract syntax",
      mechanisms: ["lint"],
      anchor: { kind: "keyword", keyword: "abstract" },
      cases: {
        flag: [{ name: "flagged", fileName: "src/a.ts", source: "abstract class A {}\n", expectedLines: [1] }],
        allow: [{ name: "allowed", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
      },
    },
  ],
});

const LINT_PIECE = JSON.stringify({
  version: 1,
  discipline: "CD-14",
  mechanism: "lint",
  clauses: [{ clause: "abstract-syntax", settings: { module: "abstract-syntax.ts" } }],
});

const TWO_MECHANISM_INSTALL: Readonly<Record<string, FakeFile>> = {
  [SELECTION_PATH]: presentFile({
    text: JSON.stringify({
      version: 1,
      ruleSets: {},
      clauses: { "CD-14#class-syntax": "audit", "CD-14#abstract-syntax": "lint" },
    }),
  }),
  [EXCEPTIONS_PATH]: presentFile({
    text: JSON.stringify({
      version: 1,
      exceptions: [
        { kind: "authorised-location", clause: "CD-14#class-syntax", file: "src/walker.ts", reason: "audit location", provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/check/run-project.test.ts; not historical authorisation" } },
        { kind: "authorised-location", clause: "CD-14#abstract-syntax", file: "src/lint.ts", reason: "lint location", provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/check/run-project.test.ts; not historical authorisation" } },
      ],
    }),
  }),
  [DISCIPLINE_PATH]: presentFile({ text: TWO_MECHANISM_DISCIPLINE }),
  [PIECE_PATH]: presentFile({ text: PIECE }),
  [LINT_PIECE_PATH]: presentFile({ text: LINT_PIECE }),
  [RUNNER_PATH]: presentFile({ text: "export const runner = {};\n" }),
  [LINT_RUNNER_PATH]: presentFile({ text: "export const runner = {};\n" }),
  "/repo/src/a.ts": presentFile({ text: "class A {}\n" }),
};

const SPLIT_WALKER_LOCATIONS = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "authorised-location",
      "clause": "CD-14#class-syntax",
      "file": "src/walker.ts",
      "reason": "audit location",
      "provenance": { "kind": "existing-authorisation", "source": "fictional unit fixture core/check/run-project.test.ts; not historical authorisation" }
    }
  ]
}
`;

const WALKER_RECORD = {
  kind: "authorised-location",
  clause: { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" },
  mechanism: "audit",
  file: "src/walker.ts",
  reason: "audit location",
  provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/check/run-project.test.ts; not historical authorisation" },
};

const modulesByPath = (modules: Readonly<Record<string, unknown>>): ModuleLoaderPort => ({
  load: ({ path }) => Promise.resolve({ outcome: "ok", value: modules[path] }),
});

const standaloneRunner = (): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const modulesLoading = (module: unknown): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: module }),
});

const GIT: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
    outcome: "ok",
    value: [repoPathSchema.parse("src/a.ts")],
  }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
};

const requiredEntry = <Entry>(request: {
  readonly table: Readonly<Record<string, Entry>>;
  readonly key: string;
}): Entry => {
  const entry = request.table[request.key];
  assert(entry !== undefined, `the fake table holds no entry for ${request.key}`);
  return entry;
};

const LEGACY_WHY = {
  why: "why is the exception taken",
  because: "the matcher cannot express the tracker id",
  evidence: "tools/why-chain-check.ts:9",
};

const LEGACY_WHY_CHAIN: LegacyWhyChain = {
  whys: [LEGACY_WHY, LEGACY_WHY, LEGACY_WHY, LEGACY_WHY, LEGACY_WHY],
  rootCause: "the audit's matcher predates the tracker id format",
  owner: "capture 01a0b421",
};

const SINGLE_FILE_RECORDS = repoPathSchema.parse("discipline-exceptions.json");

const SPLIT_FOLDER_NAME = "discipline-exceptions";

const singleFileRepositoryOver = (request: {
  readonly repoRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly git: GitPort;
}): ExceptionRepository =>
  createExceptionRepository({
    ...request,
    fileText: {
      ...request.fileText,
      exists: (query) => (query.path.endsWith(SPLIT_FOLDER_NAME) ? "absent" : request.fileText.exists(query)),
    },
    directory: {
      list: ({ path }) => ({ outcome: "failed", error: { kind: "directory-unreadable", path, detail: "the single-file fake holds no folders" } }),
      create: ({ path }) => ({ outcome: "failed", error: { kind: "directory-uncreatable", path, detail: "the single-file fake holds no folders" } }),
    },
    fileRemoval: { remove: ({ path }) => ({ outcome: "failed", error: { kind: "unremovable", path, detail: "the single-file fake removes nothing" } }) },
    gitTree: { pathsAt: () => ({ outcome: "ok", value: [SINGLE_FILE_RECORDS] }) },
  });

const SPLIT_LAYOUT_ROOT = "/repo";

const splitLayoutPortsHolding = (request: { readonly files: Readonly<Record<string, string>> }): ExceptionLayoutPorts => {
  const files = new Map(Object.entries(request.files).map(([file, text]) => [`${SPLIT_LAYOUT_ROOT}/${file}`, text]));
  const folders = new Set<string>();
  const childEntryOf = (entry: { readonly path: string; readonly folder: string }): DirectoryEntry => {
    const [name, ...rest] = entry.path.slice(entry.folder.length + 1).split("/");
    return { name, kind: rest.length === 0 ? "file" : "directory" };
  };
  return {
    path: createPathPort({ flavour: "posix", workingDirectory: () => SPLIT_LAYOUT_ROOT }),
    fileText: {
      read: ({ path }) => {
        const text = files.get(path);
        return text === undefined ? { outcome: "failed", error: { kind: "unreadable", path, detail: "ENOENT" } } : { outcome: "ok", value: text };
      },
      exists: ({ path }) =>
        files.has(path) || [...files.keys(), ...[...folders].map((folder) => `${folder}/`)].some((candidate) => candidate.startsWith(`${path}/`))
          ? "present"
          : "absent",
      write: ({ path, text }) => {
        files.set(path, text);
        return { outcome: "ok", value: undefined };
      },
    },
    directory: {
      list: ({ path }) => {
        const children = [...files.keys()].filter((candidate) => candidate.startsWith(`${path}/`)).map((candidate) => childEntryOf({ path: candidate, folder: path }));
        return {
          outcome: "ok",
          value: [...new Map(children.map((child) => [child.name, child])).values()].toSorted((left, right) => (left.name < right.name ? -1 : 1)),
        };
      },
      create: ({ path }) => {
        folders.add(path);
        return { outcome: "ok", value: undefined };
      },
    },
    fileRemoval: {
      remove: ({ path }) => {
        files.delete(path);
        return { outcome: "ok", value: undefined };
      },
    },
    git: {
      trackedPaths: () => ({ outcome: "ok", value: [] }),
      changedSince: () => ({ outcome: "ok", value: [] }),
      contentInBase: () => ({ outcome: "ok", value: "absent-from-base" }),
      textInBase: () => ({ outcome: "ok", value: { presence: "absent-from-base" } }),
      renamedSince: () => ({ outcome: "ok", value: new Map() }),
    },
    gitTree: { pathsAt: () => ({ outcome: "ok", value: [] }) },
  };
};

const projectRequest = (overrides: Partial<ProjectRequest>): ProjectRequest => {
  const ports = {
    repoRoot: absolutePathSchema.parse("/repo"),
    installRoot: absolutePathSchema.parse("/install"),
    moduleExtension: ".ts" as const,
    fileText: fileTextOver(INSTALL),
    modules: modulesLoading({ runner: standaloneRunner() }),
    path: TABLE_PATH,
    git: GIT,
    ...overrides,
  };
  return { exceptionRepository: singleFileRepositoryOver(ports), ...ports };
};

describe("runProject", () => {
  it("returns no projection writes with a standalone runner, writing no file and running nothing", async () => {
    const fileText = fileTextOver(INSTALL);
    const runner = standaloneRunner();
    const writes = await runProject(projectRequest({ fileText, modules: modulesLoading({ runner }) }));
    expect({
      writes,
      fileWrites: vi.mocked(fileText.write).mock.calls,
      runCalls: vi.mocked(runner.run).mock.calls,
      conformCalls: vi.mocked(runner.conform).mock.calls,
    }).toEqual({
      writes: { outcome: "ok", value: [] },
      fileWrites: [],
      runCalls: [],
      conformCalls: [],
    });
  });

  it("loads the runner module once from the install's mechanism runner path", async () => {
    const modules = modulesLoading({ runner: standaloneRunner() });
    const writes = await runProject(projectRequest({ modules }));
    expect({ writes, loads: vi.mocked(modules.load).mock.calls }).toEqual({
      writes: { outcome: "ok", value: [] },
      loads: [[{ path: RUNNER_PATH }]],
    });
  });

  it("is not a load failure when the exceptions file holds an invalid record", async () => {
    await expect(
      runProject(
        projectRequest({
          fileText: fileTextOver({
            ...INSTALL,
            [EXCEPTIONS_PATH]: presentFile({
              text: JSON.stringify({
                version: 1,
                exceptions: [{ kind: "authorised-location", clause: "CD-15#no-for-of", file: "src/a.ts", reason: "loop" }],
              }),
            }),
          }),
        }),
      ),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("is file-malformed for a disciplines.json that is not JSON", async () => {
    await expect(
      runProject(projectRequest({ fileText: fileTextOver({ ...INSTALL, [SELECTION_PATH]: presentFile({ text: "{" }) }) })),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "file-malformed", path: SELECTION_PATH } });
  });

  it("is file-malformed for a discipline-exceptions.json with an unknown exception kind", async () => {
    await expect(
      runProject(
        projectRequest({
          fileText: fileTextOver({
            ...INSTALL,
            [EXCEPTIONS_PATH]: presentFile({
              text: JSON.stringify({ version: 1, exceptions: [{ kind: "blanket-waiver", clause: "CD-14#class-syntax" }] }),
            }),
          }),
        }),
      ),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "file-malformed", path: EXCEPTIONS_PATH } });
  });

  it("is runner-invalid for a runner export whose exception path is outside every path", async () => {
    await expect(
      runProject(projectRequest({ modules: modulesLoading({ runner: { ...standaloneRunner(), exceptionPath: "unknown-path" } }) })),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid", mechanism: "audit" } });
  });
});

describe("runProject with an embedded runner", () => {
  it("returns the runner's projection write without running the check", async () => {
    const runner = {
      exceptionPath: "embedded",
      projectedKinds: ["config-override"],
      run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      conform: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      project: vi
        .fn<(request: unknown) => Promise<unknown>>()
        .mockResolvedValue({ outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] }),
    };
    const writes = await runProject(projectRequest({ modules: modulesLoading({ runner }) }));
    expect({ writes, runCalls: runner.run.mock.calls }).toEqual({
      writes: { outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] },
      runCalls: [],
    });
  });

  it("hands the runner's projection only the records of its own mechanism", async () => {
    const runner = {
      exceptionPath: "embedded",
      projectedKinds: ["config-override"],
      run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      conform: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      project: vi
        .fn<(request: unknown) => Promise<unknown>>()
        .mockResolvedValue({ outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] }),
    };
    const writes = await runProject(
      projectRequest({
        fileText: fileTextOver(TWO_MECHANISM_INSTALL),
        modules: modulesByPath({ [RUNNER_PATH]: { runner }, [LINT_RUNNER_PATH]: { runner: standaloneRunner() } }),
      }),
    );
    expect({ writes, projectCalls: runner.project.mock.calls }).toEqual({
      writes: { outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] },
      projectCalls: [[expect.objectContaining({ records: [WALKER_RECORD] })]],
    });
  });

  it("hands the runner's projection the records kept in the split layout", async () => {
    const runner = {
      exceptionPath: "embedded",
      projectedKinds: ["config-override"],
      run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      conform: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      project: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
    };
    const splitLayoutPorts = splitLayoutPortsHolding({ files: { "discipline-exceptions/authorised-locations/cd-14.json": SPLIT_WALKER_LOCATIONS } });

    await runProject(
      projectRequest({
        fileText: fileTextOver(TWO_MECHANISM_INSTALL),
        modules: modulesByPath({ [RUNNER_PATH]: { runner }, [LINT_RUNNER_PATH]: { runner: standaloneRunner() } }),
        exceptionRepository: createExceptionRepository({ ...splitLayoutPorts, repoRoot: absolutePathSchema.parse(SPLIT_LAYOUT_ROOT) }),
      }),
    );

    expect(runner.project.mock.calls).toEqual([[expect.objectContaining({ records: [WALKER_RECORD] })]]);
  });

  it("projects a record whose why-chain predates the causal contract, reading no base revision", async () => {
    const runner = {
      exceptionPath: "embedded",
      projectedKinds: ["config-override"],
      run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      conform: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      project: vi
        .fn<(request: unknown) => Promise<unknown>>()
        .mockResolvedValue({ outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] }),
    };
    const legacyLocation = { kind: "authorised-location", clause: "CD-14#class-syntax", file: "src/walker.ts", reason: "audit location", whyChain: LEGACY_WHY_CHAIN };
    const writes = await runProject(
      projectRequest({
        fileText: fileTextOver({
          ...TWO_MECHANISM_INSTALL,
          [EXCEPTIONS_PATH]: presentFile({ text: JSON.stringify({ version: 1, exceptions: [legacyLocation] }) }),
        }),
        modules: modulesByPath({ [RUNNER_PATH]: { runner }, [LINT_RUNNER_PATH]: { runner: standaloneRunner() } }),
      }),
    );
    expect({ writes, projectCalls: runner.project.mock.calls }).toEqual({
      writes: { outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] },
      projectCalls: [
        [expect.objectContaining({ records: [{ ...legacyLocation, clause: WALKER_RECORD.clause, mechanism: "audit" }] })],
      ],
    });
  });
});

describe("runProject for a repository that does not adopt a clause", () => {
  it("projects only the adopted clause and never loads the mechanism of the clause not adopted", async () => {
    const runner = {
      exceptionPath: "embedded",
      projectedKinds: ["config-override"],
      run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      conform: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      project: vi
        .fn<(request: unknown) => Promise<unknown>>()
        .mockResolvedValue({ outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] }),
    };
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: { runner } });
    const writes = await runProject(
      projectRequest({
        fileText: fileTextOver({
          ...TWO_MECHANISM_INSTALL,
          [SELECTION_PATH]: presentFile({
            text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "audit", "CD-14#abstract-syntax": "not-adopted" } }),
          }),
          [EXCEPTIONS_PATH]: ABSENT_FILE,
        }),
        modules: { load },
      }),
    );
    expect({ writes, loads: load.mock.calls, projectCalls: runner.project.mock.calls }).toEqual({
      writes: { outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] },
      loads: [[{ path: RUNNER_PATH }]],
      projectCalls: [
        [expect.objectContaining({ clauses: [expect.objectContaining({ address: { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" } })], records: [] })],
      ],
    });
  });
});

const PACKAGE_CONFIG_GIT: GitPort = {
  ...GIT,
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
    outcome: "ok",
    value: [repoPathSchema.parse("src/a.ts"), repoPathSchema.parse("packages/a/eslint.config.mjs")],
  }),
};

describe("runProject for a repository with a package config and a clause it does not adopt", () => {
  it("hands the runner the tracked package config and only the adopted clause, so no slice holds the clause not adopted", async () => {
    const runner = {
      exceptionPath: "embedded",
      projectedKinds: ["config-override"],
      run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      conform: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      project: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
    };
    await runProject(
      projectRequest({
        git: PACKAGE_CONFIG_GIT,
        fileText: fileTextOver({
          ...TWO_MECHANISM_INSTALL,
          [SELECTION_PATH]: presentFile({
            text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "audit", "CD-14#abstract-syntax": "not-adopted" } }),
          }),
          [EXCEPTIONS_PATH]: ABSENT_FILE,
          "/repo/packages/a/eslint.config.mjs": presentFile({ text: "export default [];\n" }),
        }),
        modules: modulesLoading({ runner }),
      }),
    );
    expect(runner.project.mock.calls).toEqual([
      [
        expect.objectContaining({
          trackedPaths: ["src/a.ts", "packages/a/eslint.config.mjs"],
          clauses: [expect.objectContaining({ address: { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" } })],
        }),
      ],
    ]);
  });
});

describe("runProject with an ESLint config root git does not track", () => {
  it("is the load failure config-root-untracked and projects nothing", async () => {
    const runner = {
      exceptionPath: "embedded",
      projectedKinds: ["config-override"],
      run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      conform: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      project: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
    };
    const outcome = await runProject(
      projectRequest({
        fileText: fileTextOver({
          ...INSTALL,
          [SELECTION_PATH]: presentFile({
            text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "audit" }, eslintConfigRoots: ["packages/missing"] }),
          }),
        }),
        modules: modulesLoading({ runner }),
      }),
    );
    expect({ outcome, projectCalls: runner.project.mock.calls }).toEqual({
      outcome: { outcome: "failed", error: { kind: "config-root-untracked", root: "packages/missing" } },
      projectCalls: [],
    });
  });

  it("hands the runner each declared folder git tracks", async () => {
    const runner = {
      exceptionPath: "embedded",
      projectedKinds: ["config-override"],
      run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      conform: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      project: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
    };
    await runProject(
      projectRequest({
        fileText: fileTextOver({
          ...INSTALL,
          [SELECTION_PATH]: presentFile({
            text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "audit" }, eslintConfigRoots: ["src"] }),
          }),
        }),
        modules: modulesLoading({ runner }),
      }),
    );
    expect(runner.project.mock.calls).toEqual([[expect.objectContaining({ declaredConfigRoots: ["src"] })]]);
  });
});
