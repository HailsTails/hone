import { assert, describe, expect, it, vi } from "vitest";
import { createExceptionRepository, type ExceptionLayoutPorts, exceptionRepositoryOf } from "../../infrastructure/discipline-exceptions-folder/exception-layout.ts";
import type { ExceptionRepositoryOf } from "../../application/ports/records/exception-repository.ts";
import type { DirectoryEntry } from "../../application/ports/file-system/directory-port.ts";
import type { EmbeddedRunReport } from "../../infrastructure/engines/protocol/embedded/embedded-run-report-schema.ts";
import type { UnprojectedFolderReport } from "../../domain/runner/mechanism-run.ts";
import type { EmbeddedRunner } from "../../infrastructure/engines/protocol/embedded/embedded-runner-module-schema.ts";
import type { LoadedRunner } from "../../application/ports/engine/runner-module.ts";
import { hitSchema } from "../../infrastructure/engines/protocol/runner-module/runner-result-schema.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../../application/ports/host/module-loader-port.ts";
import { createPathPort } from "../../infrastructure/node/path-port.ts";
import type { PathPort, RelativeLocation } from "../../application/ports/host/path-port.ts";
import type { ProcessPort } from "../../application/ports/host/process-port.ts";
import { absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import { recordDebtCommandOf } from "./run-record-debt-command.ts";
import type { VersionOneCommandRequest } from "../../application/ports/version-one-command-request.ts";
import { createDefaultEnginePort } from "../../infrastructure/engines/protocol/engine-port.ts";

const ENTRY_URL = "file:///install/src/hone.ts";

type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

type FakeFile = {
  readonly read: ReturnType<FileTextPort["read"]>;
  readonly presence: ReturnType<FileTextPort["exists"]>;
};

const presentFile = (request: { readonly text: string }): FakeFile => ({
  read: { outcome: "ok", value: request.text },
  presence: "present",
});

const presentJsonFile = (request: { readonly document: JsonValue }): FakeFile => presentFile({ text: JSON.stringify(request.document) });

const ABSENT_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } },
  presence: "absent",
};

const requiredEntry = <Entry>(request: {
  readonly table: Readonly<Record<string, Entry>>;
  readonly key: string;
}): Entry => {
  const entry = request.table[request.key];
  assert(entry !== undefined, `the fake table holds no entry for ${request.key}`);
  return entry;
};

const singleFileRepositoriesOver = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly git: GitPort;
}): ExceptionRepositoryOf =>
  ({ repoRoot }) =>
    createExceptionRepository({
      ...request,
      repoRoot,
      fileText: {
        ...request.fileText,
        exists: (query) => (query.path.endsWith("discipline-exceptions") ? "absent" : request.fileText.exists(query)),
      },
      directory: {
        list: ({ path }) => ({ outcome: "failed", error: { kind: "directory-unreadable", path, detail: "the single-file fake holds no folders" } }),
        create: ({ path }) => ({ outcome: "failed", error: { kind: "directory-uncreatable", path, detail: "the single-file fake holds no folders" } }),
      },
      fileRemoval: { remove: ({ path }) => ({ outcome: "failed", error: { kind: "unremovable", path, detail: "the single-file fake removes nothing" } }) },
      gitTree: { pathsAt: () => ({ outcome: "ok", value: [repoPathSchema.parse("discipline-exceptions.json")] }) },
    });

type RecordsDisk = {
  readonly repoRoot: AbsolutePath;
  readonly ports: ExceptionLayoutPorts;
  readonly texts: () => Readonly<Record<string, string>>;
};

const ROOT = "/repo";

const absoluteKey = (request: { readonly file: string }): string => `${ROOT}/${request.file}`;

const childEntryOf = (request: { readonly path: string; readonly folder: string }): DirectoryEntry => {
  const [name, ...rest] = request.path.slice(request.folder.length + 1).split("/");
  return { name, kind: rest.length === 0 ? "file" : "directory" };
};

const childrenOf = (request: { readonly paths: readonly string[]; readonly folder: string }): readonly DirectoryEntry[] => {
  const children = request.paths
    .filter((path) => path.startsWith(`${request.folder}/`))
    .map((path) => childEntryOf({ path, folder: request.folder }));
  return [...new Map(children.map((child) => [child.name, child])).values()];
};

const recordsDisk = (request: { readonly working: Readonly<Record<string, string>> }): RecordsDisk => {
  const files = new Map(Object.entries(request.working).map(([file, text]) => [absoluteKey({ file }), text]));
  const folders = new Set<string>();
  const occupied = (): readonly string[] => [...files.keys(), ...[...folders].map((folder) => `${folder}/`)];
  return {
    repoRoot: absolutePathSchema.parse(ROOT),
    texts: () => Object.fromEntries([...files.entries()].map(([path, text]) => [path.slice(ROOT.length + 1), text])),
    ports: {
      path: createPathPort({ flavour: "posix", workingDirectory: () => ROOT }),
      fileText: {
        read: ({ path }) => {
          const text = files.get(path);
          return text === undefined ? { outcome: "failed", error: { kind: "unreadable", path, detail: "ENOENT" } } : { outcome: "ok", value: text };
        },
        exists: ({ path }) => (files.has(path) || occupied().some((candidate) => candidate.startsWith(`${path}/`)) ? "present" : "absent"),
        write: ({ path, text }) => {
          files.set(path, text);
          return { outcome: "ok", value: undefined };
        },
      },
      directory: {
        list: ({ path }) => ({ outcome: "ok", value: childrenOf({ paths: [...files.keys()], folder: path }).toSorted((left, right) => (left.name < right.name ? -1 : 1)) }),
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
    },
  };
};

const EXCEPTIONS_PATH = "/repo/discipline-exceptions.json";


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

const repositoryFiles = (request: {
  readonly fileExceptionWhyChains: "required" | "optional";
  readonly exceptions: FakeFile;
}): Readonly<Record<string, FakeFile>> => ({
  "/repo/disciplines.json": presentJsonFile({
    document: { version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "audit" }, fileExceptionWhyChains: request.fileExceptionWhyChains },
  }),
  [EXCEPTIONS_PATH]: request.exceptions,
  "/install/package.json": ABSENT_FILE,
  "/install/rules/CD-14/discipline.json": presentJsonFile({ document: { version: 1, id: "CD-14", clauses: [CLASS_SYNTAX_DEFINITION] } }),
  "/install/src/infrastructure/engines/audit/CD-14/piece.json": presentJsonFile({
    document: { version: 1, discipline: "CD-14", mechanism: "audit", clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" } }] },
  }),
  "/install/src/infrastructure/engines/audit/runner/runner.ts": presentFile({ text: "export const runner = {};\n" }),
  "/repo/src/a.ts": presentFile({ text: "class A {}\n" }),
  "/repo/disciplines.assessment.md": ABSENT_FILE,
  "/install/rules/CD-14/README.md": presentFile({ text: "# CD-14\n" }),
});

const REASON_ONLY_NO_RECORDS = repositoryFiles({ fileExceptionWhyChains: "optional", exceptions: ABSENT_FILE });

const fileTextOver = (request: {
  readonly files: Readonly<Record<string, FakeFile>>;
  readonly writes: ReturnType<FileTextPort["write"]>;
}): FileTextPort => ({
  read: ({ path }) => requiredEntry({ table: request.files, key: path }).read,
  exists: ({ path }) => requiredEntry({ table: request.files, key: path }).presence,
  write: vi.fn<FileTextPort["write"]>().mockReturnValue(request.writes),
});

const WRITTEN: ReturnType<FileTextPort["write"]> = { outcome: "ok", value: undefined };

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const DIRECTORIES: Readonly<Record<string, string>> = {
  "/install/src/hone.ts": "/install/src",
  "/install/src": "/install",
};

const RELATIVE_TO_REPO: Readonly<Record<string, RelativeLocation>> = {
  "/repo/disciplines.json": { relation: "within-root", path: "disciplines.json" },
  [EXCEPTIONS_PATH]: { relation: "within-root", path: "discipline-exceptions.json" },
  "/install": { relation: "different-root" },
  "/install/ADOPTING.md": { relation: "different-root" },
  "/install/rules/CD-14/README.md": { relation: "different-root" },
};

const TABLE_PATH: PathPort = {
  ...POSIX_PATH,
  relative: ({ to }) => requiredEntry({ table: RELATIVE_TO_REPO, key: to }),
  directoryOf: ({ path }) => requiredEntry({ table: DIRECTORIES, key: path }),
  fromFileUrl: () => ({ outcome: "ok", value: absolutePathSchema.parse("/install/src/hone.ts") }),
};

const HIT_IN_A = {
  clause: { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" },
  file: "src/a.ts",
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
};

const runnerFinding = (request: { readonly hits: readonly unknown[] }): ModuleLoaderPort => {
  const runner: LoadedRunner = {
    exceptionPath: "standalone",
    run: vi.fn<LoadedRunner["run"]>().mockResolvedValue({ outcome: "ok", value: { hits: request.hits, nativeExceptions: [] } }),
    conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  };
  return { load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: { runner } }) };
};

const OWN_CONFIGURATION: UnprojectedFolderReport = { folder: repoPathSchema.parse("src"), selectionFolder: repoPathSchema.parse("src") };

const embeddedRunnerFinding = (request: { readonly unprojectedFolders: readonly UnprojectedFolderReport[] }): ModuleLoaderPort => {
  const report: EmbeddedRunReport = {
    hits: [hitSchema.parse(HIT_IN_A)],
    nativeExceptions: [],
    projection: "current",
    slices: [],
    unprojectedFolders: request.unprojectedFolders,
  };
  const runner: EmbeddedRunner = {
    exceptionPath: "embedded",
    projectedKinds: ["config-override"],
    run: vi.fn<EmbeddedRunner["run"]>().mockResolvedValue({ outcome: "ok", value: report }),
    conform: vi.fn<EmbeddedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
    project: vi.fn<EmbeddedRunner["project"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  };
  return { load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: { runner } }) };
};

const SOURCE_A = repoPathSchema.parse("src/a.ts");

const gitChanging = (changed: readonly RepoPath[]): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: [SOURCE_A] }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: changed }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const treeHolding = (listing: ReturnType<GitTreePort["pathsAt"]>): GitTreePort => ({
  pathsAt: vi.fn<GitTreePort["pathsAt"]>().mockReturnValue(listing),
});

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const ADOPTION_ARGUMENTS = ["--repo", "/repo", "--base-revision", "HEAD"];

type Run = {
  readonly arguments: readonly string[];
  readonly fileText: FileTextPort;
  readonly git: GitPort;
  readonly tree: GitTreePort;
  readonly modules: ModuleLoaderPort;
};

const adoptionRun = (): Run => ({
  arguments: ADOPTION_ARGUMENTS,
  fileText: fileTextOver({ files: REASON_ONLY_NO_RECORDS, writes: WRITTEN }),
  git: gitChanging([]),
  tree: treeHolding({ outcome: "ok", value: [SOURCE_A] }),
  modules: runnerFinding({ hits: [HIT_IN_A] }),
});

const recordedDebt = async (request: Run) => {
  const processPort = processWith({ arguments: request.arguments });
  const command: VersionOneCommandRequest = {
    process: processPort,
    path: TABLE_PATH,
    fileText: request.fileText,
    engine: createDefaultEnginePort({}),
    modules: request.modules,
    git: request.git,
    exceptionRepositoryOf: singleFileRepositoriesOver({ path: TABLE_PATH, fileText: request.fileText, git: request.git }),
    moduleUrl: ENTRY_URL,
  };
  await recordDebtCommandOf({ gitTree: request.tree })(command);
  return {
    writes: vi.mocked(processPort.writeOut).mock.calls,
    exits: vi.mocked(processPort.exitWith).mock.calls,
    files: vi.mocked(request.fileText.write).mock.calls,
  };
};

const EXCEPTIONS_WITH_THE_RECORD = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "file-carve-out",
      "clause": "CD-14#class-syntax",
      "file": "src/a.ts"
    }
  ]
}
`;

const EMPTY_EXCEPTIONS = `{
  "version": 1,
  "exceptions": []
}
`;

const FORFEITED_CARVE_OUT = { version: 1, exceptions: [{ kind: "file-carve-out", clause: "CD-14#class-syntax", file: "src/a.ts", reason: "legacy class" }] };

describe("recordDebtCommandOf", () => {
  it("writes a reason-only file carve-out for each broken clause and file into a new exceptions file, and prints the pair", async () => {
    expect(await recordedDebt(adoptionRun())).toEqual({
      writes: [[{ text: "CD-14#class-syntax recorded src/a.ts\n" }]],
      exits: [[{ code: 0 }]],
      files: [[{ path: EXCEPTIONS_PATH, text: EXCEPTIONS_WITH_THE_RECORD }]],
    });
  });

  it("appends to the exceptions file the repository already has", async () => {
    const files = repositoryFiles({ fileExceptionWhyChains: "optional", exceptions: presentFile({ text: EMPTY_EXCEPTIONS }) });

    const outcome = await recordedDebt({ ...adoptionRun(), fileText: fileTextOver({ files, writes: WRITTEN }) });

    expect(outcome.files).toEqual([[{ path: EXCEPTIONS_PATH, text: EXCEPTIONS_WITH_THE_RECORD }]]);
  });

  it("asks git for the paths at the --base-revision it is given", async () => {
    const tree = treeHolding({ outcome: "ok", value: [SOURCE_A] });

    await recordedDebt({ ...adoptionRun(), arguments: ["--repo", "/repo", "--base-revision", "origin/main"], tree });

    expect(vi.mocked(tree.pathsAt).mock.calls).toEqual([[{ repoRoot: "/repo", revision: "origin/main" }]]);
  });
});

describe("recordDebtCommandOf writing nothing for a pair", () => {
  it("leaves a pair under a --leave path for a person, writing nothing", async () => {
    expect(await recordedDebt({ ...adoptionRun(), arguments: ["--repo", "/repo", "--base-revision", "HEAD", "--leave", "src"] })).toEqual({
      writes: [[{ text: "CD-14#class-syntax left src/a.ts: under --leave src; record it as an authorised-location with its own reason, or fix it\n" }]],
      exits: [[{ code: 0 }]],
      files: [],
    });
  });

  it("does not record a file the base revision does not hold", async () => {
    expect(await recordedDebt({ ...adoptionRun(), tree: treeHolding({ outcome: "ok", value: [] }) })).toEqual({
      writes: [[{ text: "CD-14#class-syntax new-file src/a.ts: the base revision does not hold this file, so its debt was not inherited; fix it, or record it with its own reason\n" }]],
      exits: [[{ code: 0 }]],
      files: [],
    });
  });

  it("adds nothing for a pair whose record the check forfeits, so the forfeiture stands", async () => {
    const files = repositoryFiles({ fileExceptionWhyChains: "optional", exceptions: presentJsonFile({ document: FORFEITED_CARVE_OUT }) });

    expect(await recordedDebt({ ...adoptionRun(), fileText: fileTextOver({ files, writes: WRITTEN }), git: gitChanging([SOURCE_A]) })).toEqual({
      writes: [[{ text: "CD-14#class-syntax already-recorded src/a.ts: discipline-exceptions.json already holds a record on this clause and file; the check says why it does not hold\n" }]],
      exits: [[{ code: 0 }]],
      files: [],
    });
  });
});

describe("recordDebtCommandOf for a clause whose mechanism applies records through its projection", () => {
  it("writes nothing for a pair in a folder the runner names as loading its own config inside a folder holding its own disciplines.json, and says so", async () => {
    expect(await recordedDebt({ ...adoptionRun(), modules: embeddedRunnerFinding({ unprojectedFolders: [OWN_CONFIGURATION] }) })).toEqual({
      writes: [
        [
          {
            text: "CD-14#class-syntax nested-configuration src/a.ts: the file loads the audit configuration in src, and src holds its own disciplines.json; nested Hone configurations are not supported yet (https://github.com/HailsTails/hone/issues/72), so the audit projection cannot put a record on this file into effect; fix it, or govern src from this repository by removing src/disciplines.json, then run record-debt again\n",
          },
        ],
      ],
      exits: [[{ code: 0 }]],
      files: [],
    });
  });

  it("records a pair in a folder the runner does not name, such as one holding its own disciplines.json but no config of its own", async () => {
    expect(await recordedDebt({ ...adoptionRun(), modules: embeddedRunnerFinding({ unprojectedFolders: [] }) })).toEqual({
      writes: [[{ text: "CD-14#class-syntax recorded src/a.ts\n" }]],
      exits: [[{ code: 0 }]],
      files: [[{ path: EXCEPTIONS_PATH, text: EXCEPTIONS_WITH_THE_RECORD }]],
    });
  });
});

describe("recordDebtCommandOf when disciplines.json leaves why-chains required", () => {
  it("writes the same reason-only file carve-out, since debt needs no why-chain", async () => {
    const files = repositoryFiles({ fileExceptionWhyChains: "required", exceptions: ABSENT_FILE });

    expect(await recordedDebt({ ...adoptionRun(), fileText: fileTextOver({ files, writes: WRITTEN }) })).toEqual({
      writes: [[{ text: "CD-14#class-syntax recorded src/a.ts\n" }]],
      exits: [[{ code: 0 }]],
      files: [[{ path: EXCEPTIONS_PATH, text: EXCEPTIONS_WITH_THE_RECORD }]],
    });
  });
});

describe("recordDebtCommandOf failing to load", () => {

  it("exits 2 with the git failure when the base revision cannot be listed", async () => {
    const tree = treeHolding({ outcome: "failed", error: { kind: "git-failed", command: "git ls-tree", detail: "fatal: Not a valid object name nope" } });

    expect(await recordedDebt({ ...adoptionRun(), tree })).toEqual({
      writes: [[{ text: "load failure: git-failed git ls-tree: fatal: Not a valid object name nope\n" }]],
      exits: [[{ code: 2 }]],
      files: [],
    });
  });

  it("exits 2 naming the file when the records cannot be written", async () => {
    const refusing = fileTextOver({
      files: REASON_ONLY_NO_RECORDS,
      writes: { outcome: "failed", error: { kind: "unwritable", path: EXCEPTIONS_PATH, detail: "EACCES" } },
    });

    expect(await recordedDebt({ ...adoptionRun(), fileText: refusing })).toEqual({
      writes: [[{ text: "load failure: file-unwritable discipline-exceptions.json EACCES\n" }]],
      exits: [[{ code: 2 }]],
      files: [[{ path: EXCEPTIONS_PATH, text: EXCEPTIONS_WITH_THE_RECORD }]],
    });
  });

  it("exits 2 without running anything when --base-revision is missing", async () => {
    expect(await recordedDebt({ ...adoptionRun(), arguments: ["--repo", "/repo"] })).toEqual({
      writes: [
        [
          {
            text: "load failure: arguments-invalid hone record-debt needs --base-revision <revision>: the branch's base, the revision the run that assesses decay is given, such as origin/main; a file it does not hold gets no record\n",
          },
        ],
      ],
      exits: [[{ code: 2 }]],
      files: [],
    });
  });
});

const recordedDebtInto = async (request: { readonly run: Run; readonly disk: RecordsDisk }) => {
  const processPort = processWith({ arguments: request.run.arguments });
  await recordDebtCommandOf({ gitTree: request.run.tree })({
    process: processPort,
    path: TABLE_PATH,
    fileText: request.run.fileText,
    engine: createDefaultEnginePort({}),
    modules: request.run.modules,
    git: request.run.git,
    exceptionRepositoryOf: exceptionRepositoryOf(request.disk.ports),
    moduleUrl: ENTRY_URL,
  });
  return {
    writes: vi.mocked(processPort.writeOut).mock.calls,
    exits: vi.mocked(processPort.exitWith).mock.calls,
    texts: request.disk.texts(),
  };
};

const AUTHORISED_ELSEWHERE = `{
  "version": 1,
  "exceptions": [
    {
      "kind": "authorised-location",
      "clause": "CD-14#class-syntax",
      "file": "src/factory.ts",
      "reason": "the wrapping factory"
    }
  ]
}
`;

describe("recordDebtCommandOf in the split layout", () => {
  it("appends the record to the file that keeps that rule's file carve-outs", async () => {
    const disk = recordsDisk({ working: { "discipline-exceptions/file-carve-outs/cd-14.json": EMPTY_EXCEPTIONS } });

    expect(await recordedDebtInto({ run: adoptionRun(), disk })).toEqual({
      writes: [[{ text: "CD-14#class-syntax recorded src/a.ts\n" }]],
      exits: [[{ code: 0 }]],
      texts: { "discipline-exceptions/file-carve-outs/cd-14.json": EXCEPTIONS_WITH_THE_RECORD },
    });
  });

  it("writes a new file for that rule's file carve-outs beside its other kinds' files", async () => {
    const disk = recordsDisk({ working: { "discipline-exceptions/authorised-locations/cd-14.json": AUTHORISED_ELSEWHERE } });

    expect((await recordedDebtInto({ run: adoptionRun(), disk })).texts).toEqual({
      "discipline-exceptions/authorised-locations/cd-14.json": AUTHORISED_ELSEWHERE,
      "discipline-exceptions/file-carve-outs/cd-14.json": EXCEPTIONS_WITH_THE_RECORD,
    });
  });
});
