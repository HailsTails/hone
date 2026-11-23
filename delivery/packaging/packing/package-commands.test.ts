import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../src/application/ports/file-system/file-text-port.ts";
import type { ProcessPort } from "../../../src/application/ports/host/process-port.ts";
import { createPathPort } from "../../../src/infrastructure/node/path-port.ts";
import type { EntryDisposition, StepRun } from "../../install-proof/install-proof-plan.ts";
import type {
  CommandRunPort,
  CopiedEntry,
  ListedEntry,
  ScratchFilesPort,
} from "../../install-proof/install-proof-ports.ts";
import type { Bundle, BundledOutput, BundlerPort } from "../building/esbuild-bundler-port.ts";
import type {
  DeclarationPort,
  EmittedDeclaration,
} from "../type-declarations/package-declarations.ts";
import {
  createTarballPacker,
  type PackageCommandRequest,
  runBuildPackage,
  runPackageDeterminism,
  runPackPackage,
} from "./package-commands.ts";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const ENTRY_DECLARATIONS: readonly EmittedDeclaration[] = [
  {
    path: "src/walker.d.ts",
    text: 'export type { Result } from "./domain/result.js";\n',
    specifiers: ["./domain/result.js"],
    refusals: [],
  },
  {
    path: "src/eslint-plugin.d.ts",
    text: "export type ChecksPlugin = 1;\n",
    specifiers: [],
    refusals: [],
  },
  { path: "src/rule-set.d.ts", text: "export type RuleSet = 1;\n", specifiers: [], refusals: [] },
  {
    path: "src/testing.d.ts",
    text: "export declare const repoPathOf: 1;\n",
    specifiers: [],
    refusals: [],
  },
  {
    path: "src/domain/result.d.ts",
    text: "export type Result = 1;\n",
    specifiers: [],
    refusals: [],
  },
];

const emittingDeclarations = (request: {
  readonly declarations: readonly EmittedDeclaration[];
}): DeclarationPort => ({
  emit: () =>
    Promise.resolve({
      outcome: "ok",
      value: { declarations: request.declarations, diagnostics: [] },
    }),
});

type InMemoryFiles = {
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
  readonly texts: () => Readonly<Record<string, string>>;
  readonly pathsUnder: (request: { readonly folder: string }) => readonly string[];
};

type Placement = "inside" | "outside";

const placementOf = (request: { readonly path: string; readonly folder: string }): Placement =>
  request.path === request.folder || request.path.startsWith(`${request.folder}/`)
    ? "inside"
    : "outside";

const copyDispositionOf = (request: {
  readonly relative: string;
  readonly disposition: (entry: CopiedEntry) => EntryDisposition;
}): EntryDisposition => {
  const segments = request.relative.split("/");
  return segments.every(
    (name, index) =>
      request.disposition({
        name,
        entryKind: index === segments.length - 1 ? "file" : "folder",
      }) === "kept",
  )
    ? "kept"
    : "left-out";
};

const copiedInto = (request: {
  readonly files: ReadonlyMap<string, string>;
  readonly from: string;
  readonly to: string;
  readonly disposition: (entry: CopiedEntry) => EntryDisposition;
}): readonly (readonly [string, string])[] =>
  [...request.files.entries()]
    .filter(
      ([candidate]) =>
        placementOf({ path: candidate, folder: request.from }) === "inside" &&
        copyDispositionOf({
          relative: candidate.slice(request.from.length + 1),
          disposition: request.disposition,
        }) === "kept",
    )
    .map(([path, text]): readonly [string, string] => [
      `${request.to}${path.slice(request.from.length)}`,
      text,
    ]);

const listedUnder = (request: {
  readonly files: ReadonlyMap<string, string>;
  readonly folder: string;
}): readonly ListedEntry[] =>
  [...request.files.keys()]
    .filter((path) => path.startsWith(`${request.folder}/`))
    .sort()
    .map((path) => ({
      path: path.slice(request.folder.length + 1),
      name: path.slice(path.lastIndexOf("/") + 1),
      entryKind: "file",
    }));

const inMemoryFiles = (request: {
  readonly initial: Readonly<Record<string, string>>;
}): InMemoryFiles => {
  const files = new Map(Object.entries(request.initial));
  const temporaryRoots = { created: 0 };
  return {
    texts: () => Object.fromEntries(files),
    pathsUnder: ({ folder }) => listedUnder({ files, folder }).map((entry) => entry.path),
    fileText: {
      read: ({ path }) => {
        const text = files.get(path);
        return text === undefined
          ? { outcome: "failed", error: { kind: "unreadable", path, detail: "ENOENT" } }
          : { outcome: "ok", value: text };
      },
      exists: ({ path }) => (files.has(path) ? "present" : "absent"),
      write: ({ path, text }) => {
        files.set(path, text);
        return { outcome: "ok", value: undefined };
      },
    },
    scratch: {
      createTemporaryDirectory: ({ prefix }) => {
        temporaryRoots.created += 1;
        return { outcome: "ok", value: `/tmp/${prefix}${temporaryRoots.created}` };
      },
      removeTree: ({ path }) => {
        [...files.keys()]
          .filter((candidate) => placementOf({ path: candidate, folder: path }) === "inside")
          .forEach((key) => {
            files.delete(key);
          });
        return { outcome: "ok", value: null };
      },
      makeDirectory: () => ({ outcome: "ok", value: null }),
      copyTree: ({ from, to, disposition }) => {
        copiedInto({ files, from, to, disposition }).forEach(([path, text]) => {
          files.set(path, text);
        });
        return { outcome: "ok", value: null };
      },
      listTree: ({ path }) => ({ outcome: "ok", value: listedUnder({ files, folder: path }) }),
      digestOf: ({ path }) => {
        const text = files.get(path);
        return text === undefined
          ? { outcome: "failed", error: { kind: "effect-failed", detail: `ENOENT ${path}` } }
          : { outcome: "ok", value: `digest of ${text}` };
      },
      realPathOf: ({ path }) =>
        [...files.keys()].some(
          (candidate) => placementOf({ path: candidate, folder: path }) === "inside",
        )
          ? { outcome: "ok", value: path }
          : { outcome: "failed", error: { kind: "effect-failed", detail: `ENOENT ${path}` } },
    },
  };
};

type CommandRun = Parameters<CommandRunPort["run"]>[0];

type NpmPacking = {
  readonly commands: CommandRunPort;
  readonly runs: () => readonly CommandRun[];
};

const PACK_DESTINATION_FLAG = "--pack-destination";

const EXITED: StepRun = { outcome: "exited", exitCode: 0, output: "" };

const packDestinationOf = (request: { readonly run: CommandRun }): string | undefined =>
  request.run.arguments[0] === "pack"
    ? request.run.arguments[request.run.arguments.indexOf(PACK_DESTINATION_FLAG) + 1]
    : undefined;

const npmPacking = (request: {
  readonly files: InMemoryFiles;
  readonly tarballName: string;
  readonly tarballText: (request: { readonly packCount: number }) => string;
}): NpmPacking => {
  const recorded: { runs: readonly CommandRun[]; packCount: number } = { runs: [], packCount: 0 };
  return {
    runs: () => recorded.runs,
    commands: {
      run: (run) => {
        recorded.runs = [...recorded.runs, run];
        const destination = packDestinationOf({ run });
        if (destination !== undefined) {
          recorded.packCount += 1;
          request.files.fileText.write({
            path: `${destination}/${request.tarballName}`,
            text: request.tarballText({ packCount: recorded.packCount }),
          });
        }
        return EXITED;
      },
    },
  };
};

const SOURCE_WITHOUT_LOCK: Readonly<Record<string, string>> = {
  "/package/package.json":
    '{ "version": "0.0.0", "description": "Runs disciplines.", "keywords": ["disciplines"], "license": "MIT-0", "author": "Example Author", "private": true, "type": "module", "engines": { "node": ">=22.18.0" }, "dependencies": {}, "peerDependencies": { "typescript": ">=4.8.4 <7.0.0" }, "peerDependenciesMeta": { "typescript": { "optional": true } } }',
  "/package/tsconfig.json": '{ "extends": "./tsconfig.base.json" }',
  "/package/tsconfig.base.json": '{ "compilerOptions": { "strict": true } }',
  "/package/README.md": "# Discipline core\n",
  "/package/src/walker.ts": "export {};\n",
  "/package/src/eslint-plugin.ts": "export {};\n",
  "/package/src/rule-set.ts": "export {};\n",
  "/package/src/testing.ts": "export {};\n",
  "/package/src/hone.ts": "await run();\n",
  "/package/src/infrastructure/engines/typescript-compiler/runner/runner.ts": "await project();\n",
  "/package/src/infrastructure/disciplines-file/version-one-names.json":
    '{ "version": 1, "clauses": [], "recordKinds": {} }',
};

const EMPTY_LOCK = `lockfileVersion: '9.0'
importers:
  .: {}
snapshots: {}
`;

const SOURCE: Readonly<Record<string, string>> = {
  ...SOURCE_WITHOUT_LOCK,
  "/package/pnpm-lock.yaml": EMPTY_LOCK,
};

const entryOutput = (request: {
  readonly source: string;
  readonly path: string;
  readonly text: string;
}): BundledOutput => ({
  path: request.path,
  text: request.text,
  entryPoint: request.source,
  inputs: [request.source],
  externalImports: [],
});

const RUNNER_OUTPUT = entryOutput({
  source: "src/infrastructure/engines/typescript-compiler/runner/runner.ts",
  path: "src/infrastructure/engines/typescript-compiler/runner/runner.js",
  text: "await project();\n",
});

const API_OUTPUTS = [
  entryOutput({ source: "src/walker.ts", path: "src/walker.js", text: "export {};\n" }),
  entryOutput({
    source: "src/eslint-plugin.ts",
    path: "src/eslint-plugin.js",
    text: "export {};\n",
  }),
  entryOutput({ source: "src/rule-set.ts", path: "src/rule-set.js", text: "export {};\n" }),
  entryOutput({ source: "src/testing.ts", path: "src/testing.js", text: "export {};\n" }),
];

const BUNDLE: Bundle = {
  outputs: [
    entryOutput({ source: "src/hone.ts", path: "src/hone.js", text: "await run();\n" }),
    ...API_OUTPUTS,
    RUNNER_OUTPUT,
  ],
  packageRoots: [],
};

const DRIFTED: Bundle = {
  ...BUNDLE,
  outputs: [
    entryOutput({ source: "src/hone.ts", path: "src/hone.js", text: "drifted\n" }),
    ...API_OUTPUTS,
    RUNNER_OUTPUT,
  ],
};

const steadyBundler = (): BundlerPort => ({
  bundle: vi.fn<BundlerPort["bundle"]>().mockResolvedValue({ outcome: "ok", value: BUNDLE }),
});

const driftingBundler = (): BundlerPort => ({
  bundle: vi
    .fn<BundlerPort["bundle"]>()
    .mockResolvedValueOnce({ outcome: "ok", value: BUNDLE })
    .mockResolvedValue({ outcome: "ok", value: DRIFTED }),
});

const SAME_TARBALL = (): string => "tarball";

const NUMBERED_TARBALL = (request: { readonly packCount: number }): string =>
  `tarball ${request.packCount}`;

const npmFaking = (request: {
  readonly files: InMemoryFiles;
  readonly tarballText: (request: { readonly packCount: number }) => string;
}): NpmPacking =>
  npmPacking({
    files: request.files,
    tarballName: "hailstails-hone-0.0.0.tgz",
    tarballText: request.tarballText,
  });

const processPort = (): ProcessPort => ({
  arguments: [],
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const commandRequest = (request: {
  readonly files: InMemoryFiles;
  readonly bundler: BundlerPort;
  readonly commands: CommandRunPort;
}): PackageCommandRequest => ({
  process: processPort(),
  path: posixPath,
  fileText: request.files.fileText,
  scratch: request.files.scratch,
  bundler: request.bundler,
  declarations: emittingDeclarations({ declarations: ENTRY_DECLARATIONS }),
  commands: request.commands,
  moduleUrl: "file:///package/delivery/packaging/building/build-package.ts",
});

const reportOf = (request: { readonly process: ProcessPort }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

describe("createTarballPacker", () => {
  it("builds into the work root, packs that build with npm into the work root's tarball folder, and names the one tarball", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const npm = npmFaking({ files, tarballText: SAME_TARBALL });
    const packer = createTarballPacker({
      ports: {
        path: posixPath,
        fileText: files.fileText,
        scratch: files.scratch,
        bundler: steadyBundler(),
        declarations: emittingDeclarations({ declarations: ENTRY_DECLARATIONS }),
      },
      commands: npm.commands,
    });

    const tarball = await packer.pack({ packageRoot: "/package", workRoot: "/work" });

    expect({
      tarball,
      runs: npm.runs(),
      built: files.texts()["/work/package-build/package.json"],
    }).toEqual({
      tarball: { outcome: "ok", value: "/work/package-tarball/hailstails-hone-0.0.0.tgz" },
      runs: [
        {
          command: "npm",
          arguments: [
            "pack",
            "--ignore-scripts",
            "--pack-destination",
            "/work/package-tarball",
            "/work/package-build",
          ],
          directory: "/package",
        },
      ],
      built: expect.stringContaining('"name": "@hailstails/hone"'),
    });
  });

  it("fails with npm's output when npm pack does not succeed", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const packer = createTarballPacker({
      ports: {
        path: posixPath,
        fileText: files.fileText,
        scratch: files.scratch,
        bundler: steadyBundler(),
        declarations: emittingDeclarations({ declarations: ENTRY_DECLARATIONS }),
      },
      commands: {
        run: vi
          .fn<CommandRunPort["run"]>()
          .mockReturnValue({ outcome: "exited", exitCode: 1, output: "npm ERR! pack" }),
      },
    });

    expect(await packer.pack({ packageRoot: "/package", workRoot: "/work" })).toEqual({
      outcome: "failed",
      error:
        'FAIL: npm pack /work/package-build: {"outcome":"exited","exitCode":1,"output":"npm ERR! pack"}',
    });
  });
});

describe("runBuildPackage", () => {
  it("builds into dist, running no command", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const npm = npmFaking({ files, tarballText: SAME_TARBALL });
    const request = commandRequest({ files, bundler: steadyBundler(), commands: npm.commands });

    await runBuildPackage(request);

    expect({
      report: reportOf(request),
      runs: npm.runs(),
      left: files.pathsUnder({ folder: "/tmp" }),
    }).toEqual({
      report: {
        writes: [[{ text: "build package: wrote 20 files to /package/dist\n" }]],
        exits: [[{ code: 0 }]],
      },
      runs: [],
      left: [],
    });
  });

  it("fails naming core's lock when it cannot be read, writing nothing to dist", async () => {
    const files = inMemoryFiles({ initial: { ...SOURCE_WITHOUT_LOCK } });
    const request = commandRequest({
      files,
      bundler: steadyBundler(),
      commands: npmFaking({ files, tarballText: SAME_TARBALL }).commands,
    });

    await runBuildPackage(request);

    expect({
      report: reportOf(request),
      built: files.pathsUnder({ folder: "/package/dist" }),
    }).toEqual({
      report: {
        writes: [[{ text: expect.stringContaining("/package/pnpm-lock.yaml") }]],
        exits: [[{ code: 1 }]],
      },
      built: [],
    });
  });
});
describe("runPackPackage", () => {
  it("clears the artefacts folder, packs the dist build into it and prints the tarball", async () => {
    const files = inMemoryFiles({
      initial: { ...SOURCE, "/package/artefacts/old-0.0.0.tgz": "old" },
    });
    const request = commandRequest({
      files,
      bundler: steadyBundler(),
      commands: npmFaking({ files, tarballText: SAME_TARBALL }).commands,
    });

    await runPackPackage(request);

    expect({
      report: reportOf(request),
      old: files.texts()["/package/artefacts/old-0.0.0.tgz"],
    }).toEqual({
      report: {
        writes: [[{ text: "pack package: wrote /package/artefacts/hailstails-hone-0.0.0.tgz\n" }]],
        exits: [[{ code: 0 }]],
      },
      old: undefined,
    });
  });
});

describe("runPackageDeterminism", () => {
  it("passes when two builds into separate temporary roots and their packed tarballs are identical, and removes every temporary folder", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const request = commandRequest({
      files,
      bundler: steadyBundler(),
      commands: npmFaking({ files, tarballText: SAME_TARBALL }).commands,
    });

    await runPackageDeterminism(request);

    expect({ report: reportOf(request), left: files.pathsUnder({ folder: "/tmp" }) }).toEqual({
      report: {
        writes: [
          [
            {
              text: "package determinism: pass, 20 files and the packed tarball byte-identical across two builds\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      left: [],
    });
  });

  it("fails naming each file the two builds wrote differently", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const request = commandRequest({
      files,
      bundler: driftingBundler(),
      commands: npmFaking({ files, tarballText: SAME_TARBALL }).commands,
    });

    await runPackageDeterminism(request);

    expect(reportOf(request)).toEqual({
      writes: [[{ text: "FAIL: package determinism: two builds differ in src/hone.js\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("fails when identical builds pack into tarballs that differ", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const request = commandRequest({
      files,
      bundler: steadyBundler(),
      commands: npmFaking({ files, tarballText: NUMBERED_TARBALL }).commands,
    });

    await runPackageDeterminism(request);

    expect(reportOf(request)).toEqual({
      writes: [[{ text: "FAIL: package determinism: the two builds' packed tarballs differ\n" }]],
      exits: [[{ code: 1 }]],
    });
  });
});
