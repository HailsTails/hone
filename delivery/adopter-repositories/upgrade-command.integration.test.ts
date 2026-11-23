import { afterAll, assert, describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../src/application/ports/host/module-loader-port.ts";
import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import type { VersionOneCommandRequest } from "../../src/application/ports/version-one-command-request.ts";
import { INSTALLED_PORTS, toolSubcommandsOf } from "../../src/composition/run-tool-command.ts";
import type { ExceptionsFile } from "../../src/domain/records/discipline-exceptions/exception-record.ts";
import type { AuthorisedLocationEntry } from "../../src/domain/records/discipline-exceptions/exception-record.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import type { RunnerFailure } from "../../src/domain/runner/runner-failure.ts";
import type { Subcommand } from "../../src/infrastructure/command-line/arguments/command-line.ts";
import { shownPathOfRepository } from "../../src/infrastructure/command-line/installation/shown-path.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { createDefaultExceptionRepositoryOf } from "../../src/infrastructure/discipline-exceptions-folder/exception-layout.ts";
import { exceptionEntryParser } from "../../src/infrastructure/discipline-exceptions-folder/exception-records.ts";
import { createSelectionRepository } from "../../src/infrastructure/disciplines-file/consumer-selection.ts";
import { createChecksRunner } from "../../src/infrastructure/engines/eslint/runner/checks-runner/checks-runner.ts";
import {
  createEslintRunner,
  ESLINT_PROJECTED_KINDS,
} from "../../src/infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts";
import {
  eslint9PieceModules,
  eslint9ToolchainModules,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts";
import {
  createEslintPort,
  type EslintToolchain,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  type EslintToolchainModules,
  type EslintToolchainPeers,
  loadEslintToolchain,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import type { LoadedChecksRunner } from "../../src/infrastructure/engines/protocol/checks/checks-runner-types.ts";
import type { EmbeddedRunner } from "../../src/infrastructure/engines/protocol/embedded/embedded-runner-module-schema.ts";
import { createDefaultEnginePort } from "../../src/infrastructure/engines/protocol/engine-port.ts";
import {
  toolchainBoundChecksRunner,
  toolchainBoundEmbeddedRunner,
} from "../../src/infrastructure/engines/protocol/toolchain/toolchain-bound-runner.ts";
import { createDefaultGitPort } from "../../src/infrastructure/git/git-port.ts";
import { createDefaultFileRemovalPort } from "../../src/infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import {
  createDefaultCommandRunPort,
  createDefaultScratchFilesPort,
  type ScratchFilesPort,
} from "../install-proof/install-proof-ports.ts";

const subcommandRan = (request: {
  readonly subcommand: Subcommand;
  readonly command: VersionOneCommandRequest;
}): Promise<void> =>
  toolSubcommandsOf({ ...INSTALLED_PORTS, ...request.command })[request.subcommand](
    request.command,
  );

const VERSION_ONE = 1;

const JSON_INDENT = 2;

const selectionTextOf = (request: { readonly clauses: Readonly<Record<string, string>> }): string =>
  `${JSON.stringify({ version: VERSION_ONE, ruleSets: {}, clauses: request.clauses }, null, JSON_INDENT)}\n`;

const exceptionsTextOf = (request: { readonly exceptions: ExceptionsFile["exceptions"] }): string =>
  `${JSON.stringify({ version: VERSION_ONE, exceptions: request.exceptions }, null, JSON_INDENT)}\n`;

type ScratchRepositories = {
  readonly repositoryWith: (request: {
    readonly files: Readonly<Record<string, string>>;
  }) => AbsolutePath;
  readonly removeAll: () => void;
};

const scratchRepositoriesUnder = (request: {
  readonly parent: string;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
}): ScratchRepositories => {
  const made: AbsolutePath[] = [];
  return {
    repositoryWith: (repository) => {
      const folder = absolutePathSchema.parse(
        `${request.parent.replaceAll("\\", "/")}/scratch-${globalThis.crypto.randomUUID()}`,
      );
      const directory = request.scratch.makeDirectory({ path: folder });
      if (directory.outcome !== "ok") {
        throw new Error(
          `a scratch folder could not be made at ${folder}: ${directory.error.detail}`,
        );
      }
      made.push(folder);
      Object.entries(repository.files).forEach(([name, text]) => {
        request.fileText.write({ path: `${folder}/${name}`, text });
      });
      return folder;
    },
    removeAll: () => {
      made.forEach((folder) => {
        request.scratch.removeTree({ path: folder });
      });
    },
  };
};

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../..`);

const ENTRY_URL = new URL("../../src/hone.ts", import.meta.url).href;

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({
  parent: `${INSTALL_ROOT}/artefacts`,
  fileText,
  scratch,
});

afterAll(() => {
  repositories.removeAll();
});

const commands = createDefaultCommandRunPort({});

const repositoryWithSubfolder = (request: {
  readonly files: Readonly<Record<string, string>>;
  readonly subfolder: string;
  readonly subfolderFiles: Readonly<Record<string, string>>;
}): AbsolutePath => {
  const repo = repositories.repositoryWith({ files: request.files });
  const folder = `${repo}/${request.subfolder}`;
  const made = scratch.makeDirectory({ path: folder });
  if (made.outcome !== "ok") {
    throw new Error(`a scratch subfolder could not be made at ${folder}: ${made.error.detail}`);
  }
  Object.entries(request.subfolderFiles).forEach(([name, text]) => {
    const written = fileText.write({ path: `${folder}/${name}`, text });
    if (written.outcome !== "ok") {
      throw new Error(
        `a scratch file could not be written at ${folder}/${name}: ${written.error.detail}`,
      );
    }
  });
  return repo;
};

const directoryPort = createDefaultDirectoryPort({});

const GIT_FOLDER = ".git";

const FOLDER_MARK = "<folder>";

const pathsUnder = (request: {
  readonly folder: string;
  readonly prefix: string;
}): readonly string[] => {
  const listed = directoryPort.list({ path: absolutePathSchema.parse(request.folder) });
  if (listed.outcome !== "ok") {
    throw new Error(`${request.folder} could not be listed: ${listed.error.detail}`);
  }
  return listed.value
    .filter(({ name }) => name !== GIT_FOLDER)
    .flatMap(({ name, kind }) => {
      const shown = `${request.prefix}${name}`;
      return kind === "directory"
        ? [`${shown}/`, ...pathsUnder({ folder: `${request.folder}/${name}`, prefix: `${shown}/` })]
        : [shown];
    });
};

const listedPathsOf = (request: { readonly repo: string }): readonly string[] =>
  pathsUnder({ folder: request.repo, prefix: "" }).toSorted();

const textAt = (request: { readonly repo: string; readonly shown: string }): string => {
  const read = fileText.read({ path: `${request.repo}/${request.shown}` });
  return read.outcome === "ok" ? read.value : "<unreadable>";
};

const treeOf = (request: { readonly repo: string }): Readonly<Record<string, string>> =>
  Object.fromEntries(
    listedPathsOf(request).map((shown) => [
      shown,
      shown.endsWith("/") ? FOLDER_MARK : textAt({ repo: request.repo, shown }),
    ]),
  );

type EslintLine = "eslint-10" | "eslint-9";

const ESLINT_LINES: readonly EslintLine[] = ["eslint-10", "eslint-9"];

type LineDefinition = {
  readonly eslintVersion: RegExp;
  readonly modules: EslintToolchainModules;
  readonly pieceModules: (request: { readonly base: ModuleLoaderPort }) => ModuleLoaderPort;
};

const DEVELOPMENT_PEERS: EslintToolchainPeers = defaultEslintToolchainPeers({
  installRoot: INSTALL_ROOT,
  installForm: "source",
});

const RUNNER_MODULE_SUFFIX = "src/infrastructure/engines/eslint/runner/runner.ts";

const LINES: Readonly<Record<EslintLine, LineDefinition>> = {
  "eslint-10": {
    eslintVersion: /^10\./,
    modules: DEVELOPMENT_PEERS.modules,
    pieceModules: (request) => request.base,
  },
  "eslint-9": {
    eslintVersion: /^9\./,
    modules: eslint9ToolchainModules,
    pieceModules: eslint9PieceModules,
  },
};

const loadedEslintToolchain = async (request: {
  readonly line: EslintLine;
}): Promise<EslintToolchain> => {
  const loaded = await loadEslintToolchain({
    peers: { location: DEVELOPMENT_PEERS.location, modules: LINES[request.line].modules },
  });
  assert(
    loaded.outcome === "ok",
    `the ${request.line} toolchain loads from the development install`,
  );
  assert(
    LINES[request.line].eslintVersion.test(loaded.value.eslintVersion),
    `the ${request.line} toolchain runs ESLint ${loaded.value.eslintVersion}`,
  );
  return loaded.value;
};

const pieceModulesOn = (request: {
  readonly line: EslintLine;
  readonly base: ModuleLoaderPort;
}): ModuleLoaderPort => LINES[request.line].pieceModules({ base: request.base });

const eslintRunnerOn = (request: { readonly line: EslintLine }): EmbeddedRunner =>
  toolchainBoundEmbeddedRunner({
    toolchain: loadedEslintToolchain(request).then(
      (toolchain): Result<EslintToolchain, RunnerFailure> => ({ outcome: "ok", value: toolchain }),
    ),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createEslintRunner({
        fileText: createDefaultFileTextPort({}),
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: pieceModulesOn({ line: request.line, base: createDefaultModuleLoaderPort({}) }),
        path: createDefaultPathPort({}),
        eslint: createEslintPort({ toolchain }),
        moduleExtension: ".ts",
      }),
  });

const eslintChecksRunnerOn = (request: { readonly line: EslintLine }): LoadedChecksRunner =>
  toolchainBoundChecksRunner({
    toolchain: loadedEslintToolchain(request).then(
      (toolchain): Result<EslintToolchain, RunnerFailure> => ({ outcome: "ok", value: toolchain }),
    ),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createChecksRunner({
        fileText: createDefaultFileTextPort({}),
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: pieceModulesOn({ line: request.line, base: createDefaultModuleLoaderPort({}) }),
        path: createDefaultPathPort({}),
        eslint: createEslintPort({ toolchain }),
        moduleExtension: ".ts",
      }),
  });

const checkModulesOn = (request: { readonly line: EslintLine }): ModuleLoaderPort => {
  const pieces = pieceModulesOn({ line: request.line, base: createDefaultModuleLoaderPort({}) });
  return {
    load: (load) =>
      load.path.replaceAll("\\", "/").endsWith(RUNNER_MODULE_SUFFIX)
        ? Promise.resolve({
            outcome: "ok",
            value: { runner: eslintRunnerOn(request), checksRunner: eslintChecksRunnerOn(request) },
          })
        : pieces.load(load),
  };
};

const SELECTION =
  '{ "version": 1, "ruleSets": {}, "clauses": { "CD-14#class-syntax": "eslint", "CD-14#static-only-class": "eslint" } }\n';

const EXCEPTIONS =
  '{ "version": 1, "exceptions": [{ "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "src/kept.ts", "reason": "legacy class" }] }\n';

const TEAM_CONFIG =
  'import projection from "./disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...projection];\n';

const VERSION_ONE_FILES: Readonly<Record<string, string>> = {
  "disciplines.json": SELECTION,
  "discipline-exceptions.json": EXCEPTIONS,
  "eslint.config.mjs": TEAM_CONFIG,
};

const DEFAULT_MODULES = createDefaultModuleLoaderPort({});

const runCommandIn = async (request: {
  readonly repo: string;
  readonly subcommand: Subcommand;
  readonly options: readonly string[];
  readonly modules: ModuleLoaderPort;
}) => {
  const processPort: ProcessPort = {
    arguments: ["--repo", request.repo, ...request.options],
    writeOut: vi.fn<ProcessPort["writeOut"]>(),
    writeError: vi.fn<ProcessPort["writeError"]>(),
    exitWith: vi.fn<ProcessPort["exitWith"]>(),
  };
  await subcommandRan({
    subcommand: request.subcommand,
    command: {
      process: processPort,
      path: createDefaultPathPort({}),
      fileText,
      engine: createDefaultEnginePort({}),
      modules: request.modules,
      git: createDefaultGitPort({}),
      exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
      exceptionEntryParser,
      selectionRepositoryOf: createSelectionRepository,
      shownPathOfRepository,
      moduleUrl: ENTRY_URL,
    },
  });
  return {
    writes: vi.mocked(processPort.writeOut).mock.calls,
    exits: vi.mocked(processPort.exitWith).mock.calls,
  };
};

const trackEverything = (request: { readonly repo: string }): void => {
  commands.run({ command: "git", arguments: ["add", "."], directory: request.repo });
};

const KEPT_CLASS = "export class Kept {}\n";

const NO_RECORDS = '{ "version": 1, "exceptions": [] }\n';

type VersionOneRepositoryRequest = {
  readonly selection: string;
  readonly exceptions: string;
  readonly sources: Readonly<Record<string, string>>;
};

const versionOneRepositoryOf = async (request: VersionOneRepositoryRequest): Promise<string> => {
  const repo = repositoryWithSubfolder({
    files: {
      ...VERSION_ONE_FILES,
      "disciplines.json": request.selection,
      "discipline-exceptions.json": request.exceptions,
    },
    subfolder: "src",
    subfolderFiles: request.sources,
  });
  commands.run({ command: "git", arguments: ["init"], directory: repo });
  trackEverything({ repo });
  await runCommandIn({ repo, subcommand: "project", options: [], modules: DEFAULT_MODULES });
  trackEverything({ repo });
  return repo;
};

const versionOneRepository = (request: {
  readonly source: string;
  readonly exceptions: string;
}): Promise<string> =>
  versionOneRepositoryOf({
    selection: SELECTION,
    exceptions: request.exceptions,
    sources: { "kept.ts": request.source },
  });

const commitEverything = (request: { readonly repo: string }): void => {
  commands.run({
    command: "git",
    arguments: [
      "-c",
      "user.name=proof",
      "-c",
      "user.email=proof@example.test",
      "commit",
      "-m",
      "base",
    ],
    directory: request.repo,
  });
};

describe("hone upgrade over a real repository, through the real ports", () => {
  it("upgrades a version 1 repository, checks it with the projection current, and finds nothing left to upgrade", async () => {
    const repo = await versionOneRepository({ source: KEPT_CLASS, exceptions: EXCEPTIONS });
    const upgraded = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    trackEverything({ repo });
    const checked = await runCommandIn({
      repo,
      subcommand: "check",
      options: ["--forfeiture", "elsewhere"],
      modules: DEFAULT_MODULES,
    });
    const again = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    expect({ upgraded, checked, again }).toEqual({
      upgraded: {
        writes: [
          [
            {
              text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nwrote hone.eslint.d.mts\nrewrote eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved disciplines.json\nfile-carve-out CD-14#class-syntax src/kept.ts -> debt authored-class-or-this#class-keyword\nupgrade: same findings (0) and verdict as this Hone's version 1 check, not your installed 1.x\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      checked: {
        writes: [
          [
            {
              text: "answered (1)\nauthored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} answered by debt\nassessment (1)\nforfeiture elsewhere: 1 debt record not checked for forfeiture in this run\nverdict: pass (partial assessment)\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      again: {
        writes: [[{ text: "already on version 2; nothing to upgrade\n" }]],
        exits: [[{ code: 0 }]],
      },
    });
  });

  it("refuses a carve-out that answers no finding, and leaves every file of the repository byte for byte as it was", async () => {
    const repo = await versionOneRepository({
      source: "export const kept = 1;\n",
      exceptions: EXCEPTIONS,
    });
    const before = treeOf({ repo });
    const refused = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    expect({ refused, after: treeOf({ repo }) }).toEqual({
      refused: {
        writes: [
          [
            {
              text: "upgrade refused:\nthe file carve-out for CD-14#class-syntax in src/kept.ts answers no finding. Remove it, or fix the file it names, then run the upgrade again.\nNothing was changed.\n",
            },
          ],
        ],
        exits: [[{ code: 1 }]],
      },
      after: before,
    });
  });

  it("refuses a recorded inline disable written with a version 1 rule id, naming the version 2 id to write, and leaves every file of the repository byte for byte as it was", async () => {
    const repo = await versionOneRepository({
      source: "// eslint-disable-next-line hone/no-class-authoring\nexport class Kept {}\n",
      exceptions: EXCEPTIONS,
    });
    const before = treeOf({ repo });
    const refused = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    expect({ refused, after: treeOf({ repo }) }).toEqual({
      refused: {
        writes: [
          [
            {
              text: "upgrade refused:\nthese inline directives name a version 1 rule id, which version 2 names differently:\n  src/kept.ts:1 hone/no-class-authoring: write hone/authored-class-or-this#class-keyword\nReplace each version 1 id with the version 2 id shown, then run the upgrade again.\nNothing was changed.\n",
            },
          ],
        ],
        exits: [[{ code: 1 }]],
      },
      after: before,
    });
  });

  it("refuses an inline directive naming a hone rule id version 2 has no check under, with the file and line, and leaves every file of the repository byte for byte as it was", async () => {
    const repo = await versionOneRepository({
      source: "export class Kept {} // eslint-disable-line hone/no-such-check\n",
      exceptions: EXCEPTIONS,
    });
    const before = treeOf({ repo });
    const refused = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    expect({ refused, after: treeOf({ repo }) }).toEqual({
      refused: {
        writes: [
          [
            {
              text: "upgrade refused:\nthese inline directives name a hone rule id that version 2 has no check under:\n  src/kept.ts:1 hone/no-such-check\nFix each one to name a check of version 2, or remove it, then run the upgrade again.\nNothing was changed.\n",
            },
          ],
        ],
        exits: [[{ code: 1 }]],
      },
      after: before,
    });
  });

  it("upgrades a repository whose records are split, and checks it against a real git base revision", async () => {
    const repo = await versionOneRepository({ source: KEPT_CLASS, exceptions: EXCEPTIONS });
    await runCommandIn({
      repo,
      subcommand: "split-records",
      options: [],
      modules: DEFAULT_MODULES,
    });
    trackEverything({ repo });
    commitEverything({ repo });
    const upgraded = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    trackEverything({ repo });
    const checked = await runCommandIn({
      repo,
      subcommand: "check",
      options: ["--base-revision", "HEAD"],
      modules: DEFAULT_MODULES,
    });
    expect({ upgraded, checked }).toEqual({
      upgraded: {
        writes: [
          [
            {
              text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nwrote hone.eslint.d.mts\nrewrote eslint.config.mjs\nremoved discipline-exceptions/file-carve-outs/cd-14.json\nremoved disciplines.eslint.mjs\nremoved disciplines.json\nremoved discipline-exceptions/file-carve-outs\nremoved discipline-exceptions\nfile-carve-out CD-14#class-syntax src/kept.ts -> debt authored-class-or-this#class-keyword\nupgrade: same findings (0) and verdict as this Hone's version 1 check, not your installed 1.x\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      checked: {
        writes: [
          [
            {
              text: "answered (1)\nauthored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} answered by debt\nverdict: pass\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
    });
  });

  it("removes a single records file that holds no records, and reports only what it removed", async () => {
    const repo = await versionOneRepository({
      source: "export const kept = 1;\n",
      exceptions: NO_RECORDS,
    });
    const upgraded = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    expect({ upgraded, after: listedPathsOf({ repo }) }).toEqual({
      upgraded: {
        writes: [
          [
            {
              text: "upgraded to version 2\nwrote hone.config.json\nwrote hone.eslint.mjs\nwrote hone.eslint.d.mts\nrewrote eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved disciplines.json\nupgrade: same findings (0) and verdict as this Hone's version 1 check, not your installed 1.x\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      after: [
        "eslint.config.mjs",
        "hone.config.json",
        "hone.eslint.d.mts",
        "hone.eslint.mjs",
        "src/",
        "src/kept.ts",
      ],
    });
  });

  it("names each line of a tracked script that still mentions a version 1 file, after the records and before the proof line", async () => {
    const repo = await versionOneRepositoryOf({
      selection: SELECTION,
      exceptions: EXCEPTIONS,
      sources: {
        "kept.ts": KEPT_CLASS,
        "check.sh": "set -e\ncat disciplines.json\nrm -r discipline-exceptions\n",
      },
    });
    const upgraded = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    expect(upgraded.writes[0]?.[0]?.text).toContain(
      "authored-class-or-this#class-keyword\nmention src/check.sh:2\nmention src/check.sh:3\nupgrade: same findings (0) and verdict as this Hone's version 1 check, not your installed 1.x\n",
    );
  });

  it("refuses when the team config ignores a file the upgrade writes, as checking the committed upgrade would, and leaves every file of the repository byte for byte as it was", async () => {
    const repo = await versionOneRepository({
      source: "export const kept = 1;\n",
      exceptions: NO_RECORDS,
    });
    fileText.write({
      path: absolutePathSchema.parse(`${repo}/eslint.config.mjs`),
      text: 'import projection from "./disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, { ignores: ["*.d.mts"] }, ...projection];\n',
    });
    trackEverything({ repo });
    const before = treeOf({ repo });
    const refused = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    expect({ refused, after: treeOf({ repo }) }).toEqual({
      refused: {
        writes: [
          [
            {
              text: "upgrade refused:\nversion 2 does not report what version 1 reported:\n  unrecorded:\n    only after: eslint ignore CD-14#class-syntax hone.eslint.d.mts\n    only after: eslint ignore CD-14#static-only-class hone.eslint.d.mts\n  verdict:\n    only before: pass\n    only after: fail\nversion 2 reports files the upgrade writes: hone.eslint.d.mts. Something in your repository may treat them differently, such as an ESLint config that ignores them; let it check them, then run the upgrade again.\nNothing was changed.\n",
            },
          ],
        ],
        exits: [[{ code: 1 }]],
      },
      after: before,
    });
  });

  it("removes the declaration file a 1.x install wrote beside the projection", async () => {
    const repo = await versionOneRepository({
      source: "export const kept = 1;\n",
      exceptions: NO_RECORDS,
    });
    fileText.write({
      path: absolutePathSchema.parse(`${repo}/disciplines.eslint.d.mts`),
      text: "declare const projection: readonly unknown[];\nexport default projection;\n",
    });
    trackEverything({ repo });
    const upgraded = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    expect({ upgraded, after: listedPathsOf({ repo }) }).toEqual({
      upgraded: {
        writes: [
          [
            {
              text: "upgraded to version 2\nwrote hone.config.json\nwrote hone.eslint.mjs\nwrote hone.eslint.d.mts\nrewrote eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved disciplines.eslint.d.mts\nremoved disciplines.json\nupgrade: same findings (0) and verdict as this Hone's version 1 check, not your installed 1.x\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      after: [
        "eslint.config.mjs",
        "hone.config.json",
        "hone.eslint.d.mts",
        "hone.eslint.mjs",
        "src/",
        "src/kept.ts",
      ],
    });
  });

  it("removes a split records folder whose kind folder was emptied by an earlier prune", async () => {
    const repo = await versionOneRepository({ source: KEPT_CLASS, exceptions: EXCEPTIONS });
    await runCommandIn({
      repo,
      subcommand: "split-records",
      options: [],
      modules: DEFAULT_MODULES,
    });
    scratch.makeDirectory({
      path: absolutePathSchema.parse(`${repo}/discipline-exceptions/authorised-locations`),
    });
    trackEverything({ repo });
    const upgraded = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    expect({ upgraded, after: listedPathsOf({ repo }) }).toEqual({
      upgraded: {
        writes: [
          [
            {
              text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nwrote hone.eslint.d.mts\nrewrote eslint.config.mjs\nremoved discipline-exceptions/file-carve-outs/cd-14.json\nremoved disciplines.eslint.mjs\nremoved disciplines.json\nremoved discipline-exceptions/authorised-locations\nremoved discipline-exceptions/file-carve-outs\nremoved discipline-exceptions\nfile-carve-out CD-14#class-syntax src/kept.ts -> debt authored-class-or-this#class-keyword\nupgrade: same findings (0) and verdict as this Hone's version 1 check, not your installed 1.x\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      after: [
        "eslint.config.mjs",
        "hone-records/",
        "hone-records/debt/",
        "hone-records/debt/authored-class-or-this.json",
        "hone.config.json",
        "hone.eslint.d.mts",
        "hone.eslint.mjs",
        "src/",
        "src/kept.ts",
      ],
    });
  });
});

const PACKAGE_SELECTION =
  '{ "version": 1, "ruleSets": {}, "clauses": { "CD-14#class-syntax": "eslint", "CD-14#static-only-class": "eslint" } }\n';

const DECLARED_SELECTION =
  '{ "version": 1, "ruleSets": {}, "eslintConfigLookup": "repository-root", "eslintConfigRoots": ["packages/a"], "clauses": { "CD-14#class-syntax": "eslint", "CD-14#static-only-class": "eslint" } }\n';

const PACKAGE_CARVE_OUT =
  '{ "version": 1, "exceptions": [{ "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "packages/a/kept.ts", "reason": "legacy class" }] }\n';

const PACKAGE_CONFIG =
  'import projection from "./disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...projection];\n';

const ROOT_CONFIG_IMPORTING_PACKAGE_SLICE =
  'import projection from "./disciplines.eslint.mjs";\nimport packageProjection from "./packages/a/disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...packageProjection, ...projection];\n';

const PACKAGE_CONFIG_IMPORTING_ROOT_AND_OWN_SLICE =
  'import root from "../../disciplines.eslint.mjs";\nimport projection from "./disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...root, ...projection];\n';

const UNPROJECTING_PACKAGE_CONFIG = 'export default [{ files: ["**/*.{ts,tsx,mts,cts}"] }];\n';

const ROOT_CARVE_OUT =
  '{ "version": 1, "exceptions": [{ "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "kept.ts", "reason": "legacy class" }] }\n';

const PACKAGE_SOURCE = "export const kept = 1;\n";

const packageRepository = async (request: {
  readonly line: EslintLine;
  readonly files: Readonly<Record<string, string>>;
  readonly packageFiles: Readonly<Record<string, string>>;
}): Promise<string> => {
  const repo = repositoryWithSubfolder({
    files: request.files,
    subfolder: "packages/a",
    subfolderFiles: request.packageFiles,
  });
  commands.run({ command: "git", arguments: ["init"], directory: repo });
  trackEverything({ repo });
  const modules = checkModulesOn({ line: request.line });
  await runCommandIn({ repo, subcommand: "project", options: [], modules });
  trackEverything({ repo });
  return repo;
};

describe.each(ESLINT_LINES)(
  "hone upgrade over a real repository whose ESLint slices are not only at the root, on %s",
  (line) => {
    it("carries a package slice to version 2, rewrites the package config to import it, and leaves a repository that checks the same", async () => {
      const modules = checkModulesOn({ line });
      const repo = await packageRepository({
        line,
        files: {
          "disciplines.json": PACKAGE_SELECTION,
          "discipline-exceptions.json": PACKAGE_CARVE_OUT,
          "eslint.config.mjs": TEAM_CONFIG,
        },
        packageFiles: { "kept.ts": KEPT_CLASS, "eslint.config.mjs": PACKAGE_CONFIG },
      });
      const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules });
      trackEverything({ repo });
      const checked = await runCommandIn({
        repo,
        subcommand: "check",
        options: ["--forfeiture", "elsewhere"],
        modules,
      });
      const again = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules });
      expect({ upgraded, checked, again, after: listedPathsOf({ repo }) }).toEqual({
        upgraded: {
          writes: [
            [
              {
                text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nwrote packages/a/hone.eslint.mjs\nwrote hone.eslint.d.mts\nwrote packages/a/hone.eslint.d.mts\nrewrote eslint.config.mjs\nrewrote packages/a/eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved packages/a/disciplines.eslint.mjs\nremoved disciplines.json\nfile-carve-out CD-14#class-syntax packages/a/kept.ts -> debt authored-class-or-this#class-keyword\nupgrade: same findings (0) and verdict as this Hone's version 1 check, not your installed 1.x\n",
              },
            ],
          ],
          exits: [[{ code: 0 }]],
        },
        checked: {
          writes: [
            [
              {
                text: "answered (1)\nauthored-class-or-this#class-keyword eslint packages/a/kept.ts:1:7 export class Kept {} answered by debt\nassessment (1)\nforfeiture elsewhere: 1 debt record not checked for forfeiture in this run\nverdict: pass (partial assessment)\n",
              },
            ],
          ],
          exits: [[{ code: 0 }]],
        },
        again: {
          writes: [[{ text: "already on version 2; nothing to upgrade\n" }]],
          exits: [[{ code: 0 }]],
        },
        after: [
          "eslint.config.mjs",
          "hone-records/",
          "hone-records/debt/",
          "hone-records/debt/authored-class-or-this.json",
          "hone.config.json",
          "hone.eslint.d.mts",
          "hone.eslint.mjs",
          "packages/",
          "packages/a/",
          "packages/a/eslint.config.mjs",
          "packages/a/hone.eslint.d.mts",
          "packages/a/hone.eslint.mjs",
          "packages/a/kept.ts",
        ],
      });
    });

    it("rewrites every config that imports a projection, a package config importing the root projection beside its own", async () => {
      const modules = checkModulesOn({ line });
      const repo = await packageRepository({
        line,
        files: {
          "disciplines.json": PACKAGE_SELECTION,
          "discipline-exceptions.json": PACKAGE_CARVE_OUT,
          "eslint.config.mjs": TEAM_CONFIG,
        },
        packageFiles: {
          "kept.ts": KEPT_CLASS,
          "eslint.config.mjs": PACKAGE_CONFIG_IMPORTING_ROOT_AND_OWN_SLICE,
        },
      });
      const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules });
      trackEverything({ repo });
      const checked = await runCommandIn({
        repo,
        subcommand: "check",
        options: ["--forfeiture", "elsewhere"],
        modules,
      });
      const packageConfig = fileText.read({ path: `${repo}/packages/a/eslint.config.mjs` });
      expect({ upgraded, checked, packageConfig }).toEqual({
        upgraded: {
          writes: [
            [
              {
                text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nwrote packages/a/hone.eslint.mjs\nwrote hone.eslint.d.mts\nwrote packages/a/hone.eslint.d.mts\nrewrote eslint.config.mjs\nrewrote packages/a/eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved packages/a/disciplines.eslint.mjs\nremoved disciplines.json\nfile-carve-out CD-14#class-syntax packages/a/kept.ts -> debt authored-class-or-this#class-keyword\nupgrade: same findings (0) and verdict as this Hone's version 1 check, not your installed 1.x\n",
              },
            ],
          ],
          exits: [[{ code: 0 }]],
        },
        checked: {
          writes: [
            [
              {
                text: "answered (1)\nauthored-class-or-this#class-keyword eslint packages/a/kept.ts:1:7 export class Kept {} answered by debt\nassessment (1)\nforfeiture elsewhere: 1 debt record not checked for forfeiture in this run\nverdict: pass (partial assessment)\n",
              },
            ],
          ],
          exits: [[{ code: 0 }]],
        },
        packageConfig: {
          outcome: "ok",
          value:
            'import root from "../../hone.eslint.mjs";\nimport projection from "./hone.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...root, ...projection];\n',
        },
      });
    });

    it("carries a declared eslintConfigRoots folder under the repository-root lookup, and checks it with the same findings answered", async () => {
      const modules = checkModulesOn({ line });
      const repo = await packageRepository({
        line,
        files: {
          "disciplines.json": DECLARED_SELECTION,
          "discipline-exceptions.json": ROOT_CARVE_OUT,
          "kept.ts": KEPT_CLASS,
          "eslint.config.mjs": ROOT_CONFIG_IMPORTING_PACKAGE_SLICE,
        },
        packageFiles: {
          "kept.ts": PACKAGE_SOURCE,
          "eslint.config.mjs": UNPROJECTING_PACKAGE_CONFIG,
        },
      });
      const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules });
      trackEverything({ repo });
      const checked = await runCommandIn({
        repo,
        subcommand: "check",
        options: ["--forfeiture", "elsewhere"],
        modules,
      });
      const configuration = fileText.read({ path: `${repo}/hone.config.json` });
      expect({ upgraded, checked, configuration, after: listedPathsOf({ repo }) }).toEqual({
        upgraded: {
          writes: [
            [
              {
                text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nwrote packages/a/hone.eslint.mjs\nwrote hone.eslint.d.mts\nwrote packages/a/hone.eslint.d.mts\nrewrote eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved packages/a/disciplines.eslint.mjs\nremoved disciplines.json\nfile-carve-out CD-14#class-syntax kept.ts -> debt authored-class-or-this#class-keyword\nupgrade: same findings (0) and verdict as this Hone's version 1 check, not your installed 1.x\n",
              },
            ],
          ],
          exits: [[{ code: 0 }]],
        },
        checked: {
          writes: [
            [
              {
                text: "answered (1)\nauthored-class-or-this#class-keyword eslint kept.ts:1:7 export class Kept {} answered by debt\nassessment (1)\nforfeiture elsewhere: 1 debt record not checked for forfeiture in this run\nverdict: pass (partial assessment)\n",
              },
            ],
          ],
          exits: [[{ code: 0 }]],
        },
        configuration: {
          outcome: "ok",
          value:
            '{\n  "version": 2,\n  "ruleSets": {},\n  "checks": {\n    "authored-class-or-this#class-keyword": "eslint",\n    "authored-class-or-this#static-members-only": "eslint"\n  },\n  "eslintConfigRoots": [\n    "packages/a"\n  ],\n  "eslintConfigLookup": "repository-root"\n}\n',
        },
        after: [
          "eslint.config.mjs",
          "hone-records/",
          "hone-records/debt/",
          "hone-records/debt/authored-class-or-this.json",
          "hone.config.json",
          "hone.eslint.d.mts",
          "hone.eslint.mjs",
          "kept.ts",
          "packages/",
          "packages/a/",
          "packages/a/eslint.config.mjs",
          "packages/a/hone.eslint.d.mts",
          "packages/a/hone.eslint.mjs",
          "packages/a/kept.ts",
        ],
      });
    });

    it("refuses a package config that never imports its slice, and leaves every file of the repository byte for byte as it was", async () => {
      const modules = checkModulesOn({ line });
      const repo = await packageRepository({
        line,
        files: {
          "disciplines.json": PACKAGE_SELECTION,
          "discipline-exceptions.json": PACKAGE_CARVE_OUT,
          "eslint.config.mjs": TEAM_CONFIG,
        },
        packageFiles: { "kept.ts": KEPT_CLASS, "eslint.config.mjs": UNPROJECTING_PACKAGE_CONFIG },
      });
      const before = treeOf({ repo });
      const refused = await runCommandIn({ repo, subcommand: "upgrade", options: [], modules });
      expect({ refused, after: treeOf({ repo }) }).toEqual({
        refused: {
          writes: [
            [
              {
                text: "upgrade refused:\nthe version 1 projection packages/a/disciplines.eslint.mjs is not-applied. Run hone check with your version 1 release, fix what it reports, then run the upgrade again.\nNothing was changed.\n",
              },
            ],
          ],
          exits: [[{ code: 1 }]],
        },
        after: before,
      });
    });
  },
);

const AUDIT_SELECTION = selectionTextOf({
  clauses: {
    "CD-1#any-cast": "walker",
    "CD-1#explicit-any": "eslint",
    "CD-1#implicit-any-let": "eslint",
    "CD-2#cast-expressions": "walker",
    "CD-2#non-null-assertions": "eslint",
  },
});

const ANY_CAST = "export const parsed = JSON.parse(text) as any;\n";

const AUTHORISED_LOCATION: AuthorisedLocationEntry = {
  kind: "authorised-location",
  clause: "CD-1#any-cast",
  file: "src/located.ts",
  reason: "the parser boundary wants an any cast",
  whyChain: {
    whys: [
      {
        why: "Why does src/located.ts cast JSON.parse's result to any?",
        because:
          "Its callers read fields whose shape the payload's sender has never published, so no type describes them yet.",
        evidence: "src/located.ts:1",
      },
      {
        why: "Why has the payload's sender never published the shape of those fields?",
        because:
          "The sender is a partner export that is still in beta, and its schema changes weekly.",
        evidence: "partner ticket #31",
      },
      {
        why: "Why does the partner export's schema still change weekly in beta?",
        because:
          "The partner is adding fields as its customers ask for them, with a freeze planned for version 1.0.",
        evidence: "partner roadmap, version 1.0 milestone",
      },
      {
        why: "Why do we not type the fields before the partner's version 1.0 freeze?",
        because:
          "A type written now would go stale within a week and turn every new field into a compile error at the boundary.",
        evidence: "src/located.ts:1",
      },
      {
        why: "Why would a stale type turn new fields into compile errors at the boundary?",
        because:
          "Every caller imports the parsed value's type, so a missing field fails the build until someone updates the declaration by hand.",
        evidence: "src/open.ts:1",
      },
    ],
    rootCause:
      "Until the partner freezes its schema, a hand-kept declaration would fail the build weekly, so the any cast stays at this one boundary.",
    rootCheck:
      "partner ticket #31 still lists the schema freeze as planned for version 1.0, not shipped.",
    readback:
      "The partner's schema is not frozen, therefore a declared type would break the build weekly, therefore the fields stay untyped, therefore src/located.ts casts JSON.parse's result to any.",
    owner: "integrations team",
  },
};

const AUDIT_EXCEPTIONS = exceptionsTextOf({
  exceptions: [
    { kind: "file-carve-out", clause: "CD-1#any-cast", file: "src/owed.ts", reason: "legacy cast" },
    {
      kind: "file-carve-out",
      clause: "CD-1#explicit-any",
      file: "src/owed.ts",
      reason: "legacy cast",
    },
    AUTHORISED_LOCATION,
  ],
});

const CD_1_ONLY_SELECTION = (request: { readonly implicitAnyLet: string }): string =>
  `{ "version": 1, "ruleSets": {}, "clauses": { "CD-1#any-cast": "walker", "CD-1#explicit-any": "eslint", "CD-1#implicit-any-let": ${request.implicitAnyLet} } }\n`;

describe("hone upgrade over a real repository that selects only some disciplines", () => {
  it("refuses it before writing anything when version 1 already reports a clause of a selected discipline uncovered", async () => {
    const repo = await versionOneRepositoryOf({
      selection:
        '{ "version": 1, "ruleSets": {}, "clauses": { "CD-1#any-cast": "walker", "CD-1#explicit-any": "eslint" } }\n',
      exceptions: NO_RECORDS,
      sources: { "open.ts": ANY_CAST },
    });
    const before = treeOf({ repo });
    const refused = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    expect({ refused, after: treeOf({ repo }) }).toEqual({
      refused: {
        writes: [
          [
            {
              text: "upgrade refused:\nversion 1 already reports CD-1#implicit-any-let as uncovered. Select or mark each of them in disciplines.json, then run the upgrade again.\nNothing was changed.\n",
            },
          ],
        ],
        exits: [[{ code: 1 }]],
      },
      after: before,
    });
  });

  it("upgrades it once the rest of its discipline is marked, writing only the checks version 1 chose", async () => {
    const repo = await versionOneRepositoryOf({
      selection: CD_1_ONLY_SELECTION({ implicitAnyLet: '"not-adopted"' }),
      exceptions: NO_RECORDS,
      sources: { "open.ts": ANY_CAST },
    });
    const upgraded = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    expect(upgraded).toEqual({
      writes: [
        [
          {
            text: "upgraded to version 2\nwrote hone.config.json\nwrote hone.eslint.mjs\nwrote hone.eslint.d.mts\nrewrote eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved disciplines.json\nupgrade: same findings (2) and verdict as this Hone's version 1 check, not your installed 1.x\n",
          },
        ],
      ],
      exits: [[{ code: 0 }]],
    });
  });
});

describe("hone upgrade over a real repository that selects only CD-10", () => {
  it("upgrades it, writing only the checks of the clauses version 1 selected", async () => {
    const repo = await versionOneRepositoryOf({
      selection:
        '{ "version": 1, "ruleSets": {}, "clauses": { "CD-10#throws-in-tests": "walker", "CD-10#throw-only-error": "eslint" } }\n',
      exceptions: NO_RECORDS,
      sources: { "kept.ts": "export const kept = 1;\n" },
    });
    const upgraded = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    expect(upgraded).toEqual({
      writes: [
        [
          {
            text: "upgraded to version 2\nwrote hone.config.json\nwrote hone.eslint.mjs\nwrote hone.eslint.d.mts\nrewrote eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved disciplines.json\nupgrade: same findings (0) and verdict as this Hone's version 1 check, not your installed 1.x\n",
          },
        ],
      ],
      exits: [[{ code: 0 }]],
    });
  });
});

describe("hone upgrade over a real repository whose clause is bound to the audit mechanism", () => {
  it("upgrades it, with one finding open and one answered by debt, and checks both with the check each names", async () => {
    const repo = await versionOneRepositoryOf({
      selection: AUDIT_SELECTION,
      exceptions: AUDIT_EXCEPTIONS,
      sources: { "open.ts": ANY_CAST, "owed.ts": ANY_CAST, "located.ts": ANY_CAST },
    });
    commitEverything({ repo });
    const upgraded = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      modules: DEFAULT_MODULES,
    });
    trackEverything({ repo });
    const checked = await runCommandIn({
      repo,
      subcommand: "check",
      options: ["--base-revision", "HEAD"],
      modules: DEFAULT_MODULES,
    });
    expect({ upgraded, checked }).toEqual({
      upgraded: {
        writes: [
          [
            {
              text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/authorised-locations/claimed-type.json\nwrote hone-records/debt/claimed-type.json\nwrote hone-records/debt/untyped-value.json\nwrote hone.eslint.mjs\nwrote hone.eslint.d.mts\nrewrote eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved disciplines.json\nfile-carve-out CD-1#any-cast src/owed.ts -> debt claimed-type#cast-to-any\nfile-carve-out CD-1#explicit-any src/owed.ts -> debt untyped-value#explicit-any\nauthorised-location CD-1#any-cast src/located.ts -> authorised-location claimed-type#cast-to-any\ncarried claimed-type#cast-to-any src/located.ts\nupgrade: same findings (3) and verdict as this Hone's version 1 check, not your installed 1.x\n",
            },
          ],
        ],
        exits: [[{ code: 0 }]],
      },
      checked: {
        writes: [
          [
            {
              text: "findings (3)\nclaimed-type#cast-to-any walker src/open.ts:1:22 JSON.parse(text) as any;  may indicate: declared-not-asserted, straight-through-tests, handed-what-it-uses\nuntyped-value#explicit-any eslint src/located.ts:1:42 export const parsed = JSON.parse(text) as any; may indicate: declared-not-asserted, no-leak-across-a-boundary\nuntyped-value#explicit-any eslint src/open.ts:1:42 export const parsed = JSON.parse(text) as any; may indicate: declared-not-asserted, no-leak-across-a-boundary\nanswered (3)\nclaimed-type#cast-to-any walker src/located.ts:1:22 JSON.parse(text) as any;  answered by authorised-location carried\nclaimed-type#cast-to-any walker src/owed.ts:1:22 JSON.parse(text) as any;  answered by debt\nuntyped-value#explicit-any eslint src/owed.ts:1:42 export const parsed = JSON.parse(text) as any; answered by debt\ncarried (1)\nhone-records/authorised-locations/claimed-type.json records[0] established lacks case, owes, whyChain\nsymptoms (2)\nclaimed-type: Claimed type. May indicate: gives a value its type (declares it, or needs it narrower) → Declared, not asserted; checks a value that may be one of several outcomes → Straight-through tests; gives a value its type (declares it, or needs it narrower): in a test, a cast to build an input → Handed what it uses. The breach usually sits in the declaration: an input too wide, a generic not bounded, a missing parse. Recipes: Fix the declaration, not the value; Assert to narrow; One argument object. Correct use: an authorised location in the adapter whose outside contract forces it. Known debt: debt. Read ../../rules/typescript/symptoms.md#claimed-type\nuntyped-value: Untyped value. May indicate: gives a value its type (declares it, or needs it narrower) → Declared, not asserted; reads data from outside (request, file, environment, stored row, response) → No leak across a boundary. The breach usually sits at the boundary that let an unknown shape in. Recipes: Zod at the producer's adapter; Fix the declaration, not the value. Known debt: debt. Read ../../rules/typescript/symptoms.md#untyped-value\nverdict: fail\n",
            },
          ],
        ],
        exits: [[{ code: 1 }]],
      },
    });
  });
});

const CARRIED_EXCEPTIONS = exceptionsTextOf({
  exceptions: [
    { kind: "file-carve-out", clause: "CD-1#any-cast", file: "src/owed.ts", reason: "legacy cast" },
    {
      kind: "file-carve-out",
      clause: "CD-1#explicit-any",
      file: "src/owed.ts",
      reason: "legacy cast",
    },
    {
      kind: "file-carve-out",
      clause: "CD-1#explicit-any",
      file: "src/located.ts",
      reason: "legacy cast",
    },
    AUTHORISED_LOCATION,
  ],
});

const upgradedRepositoryWithCarriedRecords = async (): Promise<string> => {
  const repo = await versionOneRepositoryOf({
    selection: AUDIT_SELECTION,
    exceptions: CARRIED_EXCEPTIONS,
    sources: { "owed.ts": ANY_CAST, "located.ts": ANY_CAST },
  });
  commitEverything({ repo });
  await runCommandIn({ repo, subcommand: "upgrade", options: [], modules: DEFAULT_MODULES });
  trackEverything({ repo });
  return repo;
};

describe("hone check with no base revision on an upgraded repository holding carried records", () => {
  it("leaves the carried records to the run that has a base when forfeiture is left elsewhere, and passes", async () => {
    const repo = await upgradedRepositoryWithCarriedRecords();
    expect(
      await runCommandIn({
        repo,
        subcommand: "check",
        options: ["--forfeiture", "elsewhere"],
        modules: DEFAULT_MODULES,
      }),
    ).toEqual({
      writes: [
        [
          {
            text: "answered (4)\nclaimed-type#cast-to-any walker src/located.ts:1:22 JSON.parse(text) as any;  answered by authorised-location carried\nclaimed-type#cast-to-any walker src/owed.ts:1:22 JSON.parse(text) as any;  answered by debt\nuntyped-value#explicit-any eslint src/located.ts:1:42 export const parsed = JSON.parse(text) as any; answered by debt\nuntyped-value#explicit-any eslint src/owed.ts:1:42 export const parsed = JSON.parse(text) as any; answered by debt\nassessment (2)\nforfeiture elsewhere: 3 debt records not checked for forfeiture in this run\ncarried standing elsewhere: 1 carried record not checked against the base in this run\ncarried (1)\nhone-records/authorised-locations/claimed-type.json records[0] unjudged lacks case, owes, whyChain\nverdict: pass (partial assessment)\n",
          },
        ],
      ],
      exits: [[{ code: 0 }]],
    });
  });

  it("fails with import-unmeasured when forfeiture is assessed in this run", async () => {
    const repo = await upgradedRepositoryWithCarriedRecords();
    expect(
      await runCommandIn({
        repo,
        subcommand: "check",
        options: ["--forfeiture", "this-run"],
        modules: DEFAULT_MODULES,
      }),
    ).toEqual({
      writes: [
        [
          {
            text: 'answered (4)\nclaimed-type#cast-to-any walker src/located.ts:1:22 JSON.parse(text) as any;  answered by authorised-location carried\nclaimed-type#cast-to-any walker src/owed.ts:1:22 JSON.parse(text) as any;  answered by debt\nuntyped-value#explicit-any eslint src/located.ts:1:42 export const parsed = JSON.parse(text) as any; answered by debt\nuntyped-value#explicit-any eslint src/owed.ts:1:42 export const parsed = JSON.parse(text) as any; answered by debt\nunmeasured (2)\nforfeiture-unmeasured no-base-revision: no --base-revision was given, so debt cannot be checked for forfeiture; pass --base-revision with the branch\'s base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere\nimport-unmeasured no-base-revision: no --base-revision was given, so carried records cannot be checked against it; pass --base-revision with the branch\'s base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere\ncarried (1)\nhone-records/authorised-locations/claimed-type.json records[0] unjudged lacks case, owes, whyChain\nverdict: fail\n',
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });
});
