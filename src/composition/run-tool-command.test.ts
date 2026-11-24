import { assert, describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../application/ports/host/path-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { ShownPathOfRepository } from "../application/ports/installation/shown-path-of.ts";
import type { ExceptionEntryParser } from "../application/ports/records/exception-entries.ts";
import type { ExceptionRepositoryOf } from "../application/ports/records/exception-repository.ts";
import type { SelectionRepositoryOf } from "../application/ports/selection/selection-repository.ts";
import type { VersionOneCommandRequest } from "../application/ports/version-one-command-request.ts";
import type {
  HelpTopic,
  Subcommand,
} from "../infrastructure/command-line/arguments/command-line.ts";
import { runHelpText } from "../infrastructure/command-line/arguments/run-help.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import { type CommandHandler, type Subcommands, toolCommandOf } from "./composed-command.ts";
import { INSTALLED_PORTS, toolSubcommandsOf } from "./run-tool-command.ts";

const dispatchedOver = (request: {
  readonly subcommands: Subcommands;
  readonly command: VersionOneCommandRequest;
}): Promise<void> => {
  const command = toolCommandOf({ subcommands: request.subcommands, ports: request.command });
  return command(request.command);
};

const subcommandRan = (request: {
  readonly subcommand: Subcommand;
  readonly command: VersionOneCommandRequest;
}): Promise<void> =>
  toolSubcommandsOf({ ...INSTALLED_PORTS, ...request.command })[request.subcommand](
    request.command,
  );

const subcommandRanOverDirectory = (request: {
  readonly subcommand: Subcommand;
  readonly command: VersionOneCommandRequest;
  readonly directory: DirectoryPort;
}): Promise<void> =>
  toolSubcommandsOf({ ...INSTALLED_PORTS, ...request.command, directory: request.directory })[
    request.subcommand
  ](request.command);

const ENTRY_URL = "file:///install/src/hone.ts";

const commandOver = (request: {
  readonly process: ProcessPort;
  readonly fileText: FileTextPort;
}): VersionOneCommandRequest => ({
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
  exceptionRepositoryOf: vi.fn<ExceptionRepositoryOf>(),
  exceptionEntryParser: {
    parseExceptionEntries: vi.fn<ExceptionEntryParser["parseExceptionEntries"]>(),
    importedEntriesIn: vi.fn<ExceptionEntryParser["importedEntriesIn"]>(),
    importSourcesOf: vi.fn<ExceptionEntryParser["importSourcesOf"]>(),
  },
  selectionRepositoryOf: vi.fn<SelectionRepositoryOf>(),
  shownPathOfRepository: vi.fn<ShownPathOfRepository>(),
  moduleUrl: ENTRY_URL,
});

const AUTHORISE_ARGUMENTS: readonly string[] = [
  "--repo",
  "/repo",
  "--answers",
  "claimed-type",
  "--file",
  "src/a.ts",
  "--case",
  "gives-a-value-its-type",
  "--owes",
  "declared-not-asserted",
  "--why",
  "Why does the audit refuse tracker ids in carve-out names?",
  "--because",
  "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
  "--evidence",
  "tools/audit/name-matcher.ts:14",
  "--why",
  "Why does the name matcher accept only lowercase slugs?",
  "--because",
  "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
  "--evidence",
  "tools/git/branch-name.ts:8",
  "--why",
  "Why was the matcher copied from the branch-name validator?",
  "--because",
  "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
  "--evidence",
  "PR #212, merged 2026-07-02",
  "--why",
  "Why did no shared slug type exist when the audit landed?",
  "--because",
  "The values package that now holds RepoPath was split out two months after the audit.",
  "--evidence",
  "packages/values/package.json:3",
  "--why",
  "Why was the values package split out after the audit?",
  "--because",
  "The split waited on the monorepo move, which left older tools on their own patterns.",
  "--evidence",
  "docs/decisions/0007-monorepo.md:21",
  "--root-cause",
  "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  "--root-evidence",
  "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  "--readback",
  "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  "--owner",
  "capture 01a0b421",
];

const UNUSED_PATH: PathPort = {
  join: vi.fn<PathPort["join"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const UNUSED_FILE_TEXT: FileTextPort = {
  read: vi.fn<FileTextPort["read"]>(),
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>(),
};

const UNUSED_MODULES: ModuleLoaderPort = { load: vi.fn<ModuleLoaderPort["load"]>() };

const UNUSED_GIT: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
};

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const commandRequest = (request: { readonly process: ProcessPort }): VersionOneCommandRequest => ({
  process: request.process,
  path: UNUSED_PATH,
  fileText: UNUSED_FILE_TEXT,
  modules: UNUSED_MODULES,
  git: UNUSED_GIT,
  exceptionRepositoryOf: vi.fn<ExceptionRepositoryOf>(),
  exceptionEntryParser: {
    parseExceptionEntries: vi.fn<ExceptionEntryParser["parseExceptionEntries"]>(),
    importedEntriesIn: vi.fn<ExceptionEntryParser["importedEntriesIn"]>(),
    importSourcesOf: vi.fn<ExceptionEntryParser["importSourcesOf"]>(),
  },
  selectionRepositoryOf: vi.fn<SelectionRepositoryOf>(),
  shownPathOfRepository: vi.fn<ShownPathOfRepository>(),
  moduleUrl: ENTRY_URL,
});

const subcommandsSpied = (): Subcommands => ({
  check: vi.fn<CommandHandler>().mockResolvedValue(undefined),
  project: vi.fn<CommandHandler>().mockResolvedValue(undefined),
  "record-debt": vi.fn<CommandHandler>().mockResolvedValue(undefined),
  "prune-debt": vi.fn<CommandHandler>().mockResolvedValue(undefined),
  authorise: vi.fn<CommandHandler>().mockResolvedValue(undefined),
  "split-records": vi.fn<CommandHandler>().mockResolvedValue(undefined),
  upgrade: vi.fn<CommandHandler>().mockResolvedValue(undefined),
});

const callsOf = (request: { readonly subcommands: Subcommands }) => ({
  check: vi.mocked(request.subcommands.check).mock.calls,
  project: vi.mocked(request.subcommands.project).mock.calls,
  recordDebt: vi.mocked(request.subcommands["record-debt"]).mock.calls,
  pruneDebt: vi.mocked(request.subcommands["prune-debt"]).mock.calls,
});

const outputOf = (request: { readonly process: ProcessPort }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

describe("toolCommandOf", () => {
  it("runs the check subcommand with the same ports and the arguments after it", async () => {
    const subcommands = subcommandsSpied();
    const request = commandRequest({
      process: processWith({ arguments: ["check", "--repo", "/repo"] }),
    });

    await dispatchedOver({ subcommands, command: request });

    expect(callsOf({ subcommands })).toEqual({
      check: [[{ ...request, process: { ...request.process, arguments: ["--repo", "/repo"] } }]],
      project: [],
      recordDebt: [],
      pruneDebt: [],
    });
  });

  it("runs the project subcommand with the same ports and the arguments after it", async () => {
    const subcommands = subcommandsSpied();
    const request = commandRequest({
      process: processWith({ arguments: ["project", "--repo", "/repo"] }),
    });

    await dispatchedOver({ subcommands, command: request });

    expect(callsOf({ subcommands })).toEqual({
      check: [],
      project: [[{ ...request, process: { ...request.process, arguments: ["--repo", "/repo"] } }]],
      recordDebt: [],
      pruneDebt: [],
    });
  });

  it("runs the record-debt subcommand with the same ports and the arguments after it", async () => {
    const subcommands = subcommandsSpied();
    const request = commandRequest({
      process: processWith({
        arguments: ["record-debt", "--repo", "/repo", "--base-revision", "HEAD"],
      }),
    });

    await dispatchedOver({ subcommands, command: request });

    expect(callsOf({ subcommands })).toEqual({
      check: [],
      project: [],
      recordDebt: [
        [
          {
            ...request,
            process: {
              ...request.process,
              arguments: ["--repo", "/repo", "--base-revision", "HEAD"],
            },
          },
        ],
      ],
      pruneDebt: [],
    });
  });

  it("runs the prune-debt subcommand with the same ports and the arguments after it", async () => {
    const subcommands = subcommandsSpied();
    const request = commandRequest({
      process: processWith({
        arguments: ["prune-debt", "--repo", "/repo", "--base-revision", "origin/main"],
      }),
    });

    await dispatchedOver({ subcommands, command: request });

    expect(callsOf({ subcommands })).toEqual({
      check: [],
      project: [],
      recordDebt: [],
      pruneDebt: [
        [
          {
            ...request,
            process: {
              ...request.process,
              arguments: ["--repo", "/repo", "--base-revision", "origin/main"],
            },
          },
        ],
      ],
    });
  });
});

const ranNothing = { check: [], project: [], recordDebt: [], pruneDebt: [] };

describe("toolCommandOf refusing an invocation it cannot read", () => {
  it.each([
    {
      given: [],
      line: "load failure: arguments-invalid hone needs a command, check, project, record-debt, prune-debt, authorise, split-records or upgrade; run hone --help for usage\n",
    },
    {
      given: ["lint", "--repo", "/repo"],
      line: 'load failure: arguments-invalid hone has no command "lint"; its commands are check, project, record-debt, prune-debt, authorise, split-records and upgrade; run hone --help for usage\n',
    },
  ])(
    "exits 2 with the arguments-invalid line and runs nothing, given $given",
    async ({ given, line }) => {
      const subcommands = subcommandsSpied();
      const processPort = processWith({ arguments: given });

      await dispatchedOver({ subcommands, command: commandRequest({ process: processPort }) });

      expect({ output: outputOf({ process: processPort }), ran: callsOf({ subcommands }) }).toEqual(
        {
          output: { writes: [[{ text: line }]], exits: [[{ code: 2 }]] },
          ran: ranNothing,
        },
      );
    },
  );
});

const helpRequest = (request: {
  readonly process: ProcessPort;
  readonly exists: FileTextPort["exists"];
}): VersionOneCommandRequest => ({
  ...commandRequest({ process: request.process }),
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: { ...UNUSED_FILE_TEXT, exists: request.exists },
});

describe("toolCommandOf printing help", () => {
  it.each([
    { given: ["--help"], topic: "tool" },
    { given: ["check", "--repo", "/repo", "--help"], topic: "check" },
    { given: ["project", "-h"], topic: "project" },
    { given: ["upgrade", "--help"], topic: "upgrade" },
  ] as const)(
    "prints version 2's $topic help for a version 2 repository, and for no repository, and exits 0, running nothing, given $given",
    async ({ given, topic }) => {
      const subcommands = subcommandsSpied();
      const processPort = processWith({ arguments: given });

      await dispatchedOver({
        subcommands,
        command: helpRequest({
          process: processPort,
          exists: vi
            .fn<FileTextPort["exists"]>()
            .mockReturnValueOnce("absent")
            .mockReturnValue("present"),
        }),
      });

      expect({ output: outputOf({ process: processPort }), ran: callsOf({ subcommands }) }).toEqual(
        {
          output: { writes: [[{ text: runHelpText({ topic }) }]], exits: [[{ code: 0 }]] },
          ran: ranNothing,
        },
      );
    },
  );

  it.each([
    { given: ["--help"], topic: "tool" },
    { given: ["check", "--repo", "/repo", "--help"], topic: "check" },
    { given: ["project", "--repo", "/repo", "--help"], topic: "project" },
    { given: ["record-debt", "--repo", "/repo", "-h"], topic: "record-debt" },
    { given: ["prune-debt", "--repo", "/repo", "--help"], topic: "prune-debt" },
    { given: ["authorise", "--repo", "/repo", "--help"], topic: "authorise" },
    { given: ["upgrade", "--repo", "/repo", "--help"], topic: "upgrade" },
    { given: ["split-records", "--repo", "/repo", "--help"], topic: "split-records" },
  ] satisfies readonly { readonly given: readonly string[]; readonly topic: HelpTopic }[])(
    "prints current $topic help for a repository holding disciplines.json without running a command, given $given",
    async ({ given, topic }) => {
      const subcommands = subcommandsSpied();
      const processPort = processWith({ arguments: given });

      await dispatchedOver({
        subcommands,
        command: helpRequest({
          process: processPort,
          exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
        }),
      });

      expect({ output: outputOf({ process: processPort }), ran: callsOf({ subcommands }) }).toEqual(
        {
          output: { writes: [[{ text: runHelpText({ topic }) }]], exits: [[{ code: 0 }]] },
          ran: ranNothing,
        },
      );
    },
  );

  it("prints version 2's help for a repository holding neither settings file", async () => {
    const processPort = processWith({ arguments: ["check", "--repo", "/repo", "--help"] });

    await dispatchedOver({
      subcommands: subcommandsSpied(),
      command: helpRequest({
        process: processPort,
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
      }),
    });

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: runHelpText({ topic: "check" }) }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("prints migration help for split-records for a version 2 repository", async () => {
    const processPort = processWith({ arguments: ["split-records", "--repo", "/repo", "--help"] });

    await dispatchedOver({
      subcommands: subcommandsSpied(),
      command: helpRequest({
        process: processPort,
        exists: vi
          .fn<FileTextPort["exists"]>()
          .mockReturnValueOnce("absent")
          .mockReturnValue("present"),
      }),
    });

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: runHelpText({ topic: "split-records" }) }]],
      exits: [[{ code: 0 }]],
    });
  });
});

const PACKAGE_PATH = "/install/package.json";

const versionRequest = (request: {
  readonly process: ProcessPort;
  readonly read: ReturnType<FileTextPort["read"]>;
}): VersionOneCommandRequest => ({
  ...commandRequest(request),
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
  fileText: {
    ...UNUSED_FILE_TEXT,
    read: vi.fn<FileTextPort["read"]>().mockReturnValue(request.read),
  },
});

describe("toolCommandOf printing the version", () => {
  it("prints the installed version and exits 0, running nothing", async () => {
    const subcommands = subcommandsSpied();
    const processPort = processWith({ arguments: ["--version"] });

    await dispatchedOver({
      subcommands,
      command: versionRequest({
        process: processPort,
        read: { outcome: "ok", value: '{ "version": "1.2.3" }' },
      }),
    });

    expect({ output: outputOf({ process: processPort }), ran: callsOf({ subcommands }) }).toEqual({
      output: { writes: [[{ text: "1.2.3\n" }]], exits: [[{ code: 0 }]] },
      ran: ranNothing,
    });
  });

  it("exits 2 with the load failure line when the install's package.json cannot be read", async () => {
    const processPort = processWith({ arguments: ["--version"] });

    await dispatchedOver({
      subcommands: subcommandsSpied(),
      command: versionRequest({
        process: processPort,
        read: {
          outcome: "failed",
          error: { kind: "unreadable", path: PACKAGE_PATH, detail: "EACCES" },
        },
      }),
    });

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "load failure: file-unreadable /install/package.json EACCES\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});

const rejecting: CommandHandler = () =>
  Promise.reject(new Error("Cannot read properties of undefined"));

const throwing: CommandHandler = () => Promise.resolve(BigInt("one")).then(() => undefined);

describe("toolCommandOf when a command fails unexpectedly", () => {
  it.each([
    {
      handler: rejecting,
      line: "load failure: unexpected-error Cannot read properties of undefined\n",
    },
    { handler: throwing, line: "load failure: unexpected-error Cannot convert one to a BigInt\n" },
  ])(
    "exits 2 with an unexpected-error load failure line, so exit 1 always means a failing verdict: $line",
    async ({ handler, line }) => {
      const processPort = processWith({ arguments: ["check", "--repo", "/repo"] });

      await dispatchedOver({
        subcommands: {
          check: handler,
          project: handler,
          "record-debt": handler,
          "prune-debt": handler,
          authorise: handler,
          "split-records": handler,
          upgrade: handler,
        },
        command: commandRequest({ process: processPort }),
      });

      expect(outputOf({ process: processPort })).toEqual({
        writes: [[{ text: line }]],
        exits: [[{ code: 2 }]],
      });
    },
  );
});

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });

const UNRESOLVABLE_PATH: PathPort = {
  ...POSIX_PATH,
  resolve: ({ path }) => ({
    outcome: "failed",
    error: { kind: "working-directory-unusable", path },
  }),
};

describe("TOOL_SUBCOMMANDS authorise, which has no version 1 form", () => {
  it.each([
    {
      case: "a repository holding disciplines.json",
      disciplines: "present",
      config: "absent",
      path: POSIX_PATH,
      arguments: ["--repo", "/repo"],
      line: "load failure: upgrade-needed disciplines.json: this is a version 1 file; run node /install/src/hone.ts upgrade --repo /repo, which rewrites every version 1 file as version 2, and commit what it writes\n",
    },
    {
      case: "a folder holding neither settings file",
      disciplines: "absent",
      config: "absent",
      path: POSIX_PATH,
      arguments: ["--repo", "/repo"],
      line: "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root\n",
    },
    {
      case: "no --repo",
      disciplines: "absent",
      config: "absent",
      path: POSIX_PATH,
      arguments: [],
      line: "load failure: arguments-invalid hone authorise needs --repo <dir>: the folder that holds hone.config.json, usually the repository root\n",
    },
    {
      case: "a --repo that resolves to no absolute path",
      disciplines: "absent",
      config: "absent",
      path: UNRESOLVABLE_PATH,
      arguments: ["--repo", "src"],
      line: "load failure: arguments-invalid --repo src resolves to no absolute path\n",
    },
  ] as const)(
    "prints one load failure line naming what is wrong, and exits 2, given $case",
    async ({ disciplines, config, path, arguments: given, line }) => {
      const processPort = processWith({ arguments: given });

      await subcommandRan({
        subcommand: "authorise",
        command: {
          ...commandOver({
            process: processPort,
            fileText: {
              ...UNUSED_FILE_TEXT,
              exists: vi
                .fn<FileTextPort["exists"]>()
                .mockReturnValueOnce(disciplines)
                .mockReturnValueOnce(config)
                .mockReturnValueOnce(disciplines)
                .mockReturnValue(config),
            },
          }),
          path,
        },
      });

      expect(outputOf({ process: processPort })).toEqual({
        writes: [[{ text: line }]],
        exits: [[{ code: 2 }]],
      });
    },
  );
});

const CONFIG_ABSENT_LINE =
  "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root\n";

const VERSION_ONE_NAMES_READ = {
  outcome: "ok",
  value: '{ "version": 1, "clauses": [], "recordKinds": {} }',
} as const;

const AUTHORISED_LOCATION_KIND_READ = {
  outcome: "ok",
  value: '# Authorised location\n\n```json\n{ "phrase": "an authorised location" }\n```\n',
} as const;

const DEBT_KIND_READ = {
  outcome: "ok",
  value: '# Debt\n\n```json\n{ "phrase": "debt" }\n```\n',
} as const;

describe("TOOL_SUBCOMMANDS on a folder holding neither settings file", () => {
  it.each([
    { subcommand: "check", given: ["--repo", "/repo"] },
    { subcommand: "project", given: ["--repo", "/repo"] },
    { subcommand: "record-debt", given: ["--repo", "/repo", "--base-revision", "main"] },
    { subcommand: "prune-debt", given: ["--repo", "/repo", "--base-revision", "main"] },
    { subcommand: "upgrade", given: ["--repo", "/repo"] },
    { subcommand: "split-records", given: ["--repo", "/repo"] },
    { subcommand: "authorise", given: AUTHORISE_ARGUMENTS },
  ] as const)(
    "prints the config-absent line and exits 2, given $subcommand",
    async ({ subcommand, given }) => {
      const processPort = processWith({ arguments: given });
      const command = commandOver({
        process: processPort,
        fileText: {
          ...UNUSED_FILE_TEXT,
          exists: vi
            .fn<FileTextPort["exists"]>()
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("present")
            .mockReturnValue("absent"),
          read: vi
            .fn<FileTextPort["read"]>()
            .mockReturnValueOnce(VERSION_ONE_NAMES_READ)
            .mockReturnValueOnce(AUTHORISED_LOCATION_KIND_READ)
            .mockReturnValueOnce(DEBT_KIND_READ),
        },
      });
      const directory: DirectoryPort = {
        list: vi
          .fn<DirectoryPort["list"]>()
          .mockReturnValueOnce({
            outcome: "ok",
            value: [{ name: "record-kinds", kind: "directory" }],
          })
          .mockReturnValueOnce({
            outcome: "ok",
            value: [
              { name: "authorised-location.md", kind: "file" },
              { name: "debt.md", kind: "file" },
            ],
          }),
        create: vi.fn<DirectoryPort["create"]>(),
      };

      await subcommandRanOverDirectory({ subcommand, command, directory });

      expect(outputOf({ process: processPort })).toEqual({
        writes: [[{ text: CONFIG_ABSENT_LINE }]],
        exits: [[{ code: 2 }]],
      });
    },
  );
});

describe("TOOL_SUBCOMMANDS on a repository holding hone.config.json", () => {
  it.each(["split-records"] as const)(
    "prints one not-ready-yet line naming %s and exits 2",
    async (subcommand) => {
      const processPort = processWith({ arguments: ["--repo", "/repo"] });
      const request = {
        ...commandRequest({ process: processPort }),
        path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
        fileText: {
          ...UNUSED_FILE_TEXT,
          exists: vi
            .fn<FileTextPort["exists"]>()
            .mockReturnValueOnce("absent")
            .mockReturnValueOnce("present"),
        },
      };

      await subcommandRan({ subcommand, command: request });

      expect(outputOf({ process: processPort })).toEqual({
        writes: [
          [
            {
              text: `load failure: not-ready-yet ${subcommand}: this release runs ${subcommand} on version 1 files only, and this repository holds hone.config.json
`,
            },
          ],
        ],
        exits: [[{ code: 2 }]],
      });
    },
  );
});
