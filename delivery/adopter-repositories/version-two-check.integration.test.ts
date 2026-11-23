import { afterAll, assert, describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import type { ShownPathOfRepository } from "../../src/application/ports/installation/shown-path-of.ts";
import type { ExceptionEntryParser } from "../../src/application/ports/records/exception-entries.ts";
import type { ExceptionRepositoryOf } from "../../src/application/ports/records/exception-repository.ts";
import type { SelectionRepositoryOf } from "../../src/application/ports/selection/selection-repository.ts";
import type { VersionOneCommandRequest } from "../../src/application/ports/version-one-command-request.ts";
import { INSTALLED_PORTS, toolSubcommandsOf } from "../../src/composition/run-tool-command.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Subcommand } from "../../src/infrastructure/command-line/arguments/command-line.ts";
import { projectCommandOf } from "../../src/infrastructure/command-line/arguments/tool-invocations.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import {
  CHECKS_DECLARATION_PATH,
  CHECKS_PROJECTION_PATH,
  checksProjectionText,
} from "../../src/infrastructure/engines/eslint/runner/projection/checks-projection.ts";
import { installedEslintBoundary } from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { createDefaultGitPort } from "../../src/infrastructure/git/git-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import {
  type CommandRunPort,
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

const installedBoundary = await installedEslintBoundary();

if (installedBoundary.outcome === "failed") {
  throw new Error(installedBoundary.error);
}

const DECLARATION_TEXT: string = installedBoundary.value.declarationText;

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

const GIT_STEPS: readonly (readonly string[])[] = [["init"], ["add", "."]];

const trackedRepositoryWith = (request: {
  readonly repositories: ScratchRepositories;
  readonly commands: CommandRunPort;
  readonly files: Readonly<Record<string, string>>;
}): string => {
  const repo = request.repositories.repositoryWith({ files: request.files });
  GIT_STEPS.forEach((gitArguments) => {
    const run = request.commands.run({ command: "git", arguments: gitArguments, directory: repo });
    if (run.outcome !== "exited" || run.exitCode !== 0) {
      throw new Error(`git ${gitArguments.join(" ")} failed in ${repo}`);
    }
  });
  return repo;
};

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../..`);

const ENTRY_URL = new URL("../../src/hone.ts", import.meta.url).href;

const fileText = createDefaultFileTextPort({});

const repositories = scratchRepositoriesUnder({
  parent: `${INSTALL_ROOT}/artefacts`,
  fileText,
  scratch: createDefaultScratchFilesPort({}),
});

afterAll(() => {
  repositories.removeAll();
});

const commands = createDefaultCommandRunPort({});

const CONFIG = `{
  "version": 2,
  "exclude": [],
  "ruleSets": {},
  "checks": { "authored-class-or-this#class-keyword": "eslint" },
  "checkSettings": {},
  "layers": {}
}
`;

const PROJECTION_IMPORT = `import hone from "./${CHECKS_PROJECTION_PATH}";\nexport default [...hone];\n`;

const PROJECTION = checksProjectionText({
  pluginImport: "../../src/eslint-plugin.ts",
  checks: [
    {
      ruleSet: "hone",
      symptom: "authored-class-or-this",
      check: "class-keyword",
      ruleId: "hone/authored-class-or-this#class-keyword",
      options: [],
    },
  ],
  answered: [],
});

const EXPECTED_REPORT = `findings (1)
authored-class-or-this#class-keyword eslint kept.ts:1:7 export class Kept {} symptom: authored-class-or-this (../../rules/typescript/symptoms.md#authored-class-or-this) may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
available (1)
authored-class-or-this#static-members-only
symptoms (1)
authored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. Read ../../rules/typescript/symptoms.md#authored-class-or-this
verdict: fail
`;

const runCommandIn = async (request: {
  readonly repo: string;
  readonly subcommand: Subcommand;
  readonly options: readonly string[];
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
      modules: createDefaultModuleLoaderPort({}),
      git: createDefaultGitPort({}),
      exceptionRepositoryOf: vi.fn<ExceptionRepositoryOf>(),
      exceptionEntryParser: {
        parseExceptionEntries: vi.fn<ExceptionEntryParser["parseExceptionEntries"]>(),
        importedEntriesIn: vi.fn<ExceptionEntryParser["importedEntriesIn"]>(),
        importSourcesOf: vi.fn<ExceptionEntryParser["importSourcesOf"]>(),
      },
      selectionRepositoryOf: vi.fn<SelectionRepositoryOf>(),
      shownPathOfRepository: vi.fn<ShownPathOfRepository>(),
      moduleUrl: ENTRY_URL,
    },
  });
  return {
    writes: vi.mocked(processPort.writeOut).mock.calls,
    exits: vi.mocked(processPort.exitWith).mock.calls,
  };
};

describe("the tool's commands on a repository holding hone.config.json, through the real ports", () => {
  it("prints the version 2 report for a class the ESLint runner finds, naming the check and the symptom, and exits 1", async () => {
    const repo = trackedRepositoryWith({
      repositories,
      commands,
      files: {
        "hone.config.json": CONFIG,
        "eslint.config.mjs": PROJECTION_IMPORT,
        [CHECKS_PROJECTION_PATH]: PROJECTION,
        [CHECKS_DECLARATION_PATH]: DECLARATION_TEXT,
        "kept.ts": "export class Kept {}\n",
      },
    });
    expect(await runCommandIn({ repo, subcommand: "check", options: [] })).toEqual({
      writes: [[{ text: EXPECTED_REPORT }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("records the class the base revision holds as debt through record-debt, printing the symptom and file and exiting 0", async () => {
    const repo = trackedRepositoryWith({
      repositories,
      commands,
      files: {
        "hone.config.json": CONFIG,
        "eslint.config.mjs": PROJECTION_IMPORT,
        [CHECKS_PROJECTION_PATH]: PROJECTION,
        [CHECKS_DECLARATION_PATH]: DECLARATION_TEXT,
        "kept.ts": "export class Kept {}\n",
      },
    });
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
      directory: repo,
    });
    const recorded = await runCommandIn({
      repo,
      subcommand: "record-debt",
      options: ["--base-revision", "HEAD"],
    });
    const path = createDefaultPathPort({});
    const resolved = path.resolve({ path: repo });
    assert(resolved.outcome === "ok", "the repository path resolves");
    const projectCommand = projectCommandOf({
      path,
      moduleUrl: ENTRY_URL,
      repoRoot: resolved.value,
    });
    assert(projectCommand.outcome === "ok", "the project command is made");
    expect(recorded).toEqual({
      writes: [
        [
          {
            text: `authored-class-or-this#class-keyword recorded kept.ts\nrun ${projectCommand.value} to put the recorded debt into effect\n`,
          },
        ],
      ],
      exits: [[{ code: 0 }]],
    });
  });

  it("writes the projection through project, confirms it unchanged the second time, and then checks with the projection current", async () => {
    const repo = trackedRepositoryWith({
      repositories,
      commands,
      files: {
        "hone.config.json": CONFIG,
        "eslint.config.mjs": PROJECTION_IMPORT,
        "kept.ts": "export class Kept {}\n",
      },
    });
    expect({
      first: await runCommandIn({ repo, subcommand: "project", options: [] }),
      second: await runCommandIn({ repo, subcommand: "project", options: [] }),
      checked: await runCommandIn({ repo, subcommand: "check", options: [] }),
    }).toEqual({
      first: {
        writes: [[{ text: "hone.eslint.mjs written\nhone.eslint.d.mts written\n" }]],
        exits: [[{ code: 0 }]],
      },
      second: {
        writes: [[{ text: "hone.eslint.mjs unchanged\nhone.eslint.d.mts unchanged\n" }]],
        exits: [[{ code: 0 }]],
      },
      checked: { writes: [[{ text: EXPECTED_REPORT }]], exits: [[{ code: 1 }]] },
    });
  });
});
