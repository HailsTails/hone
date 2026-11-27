import { assert, describe, expect, it, vi } from "vitest";

import type { DirectoryRemovalPort } from "../application/ports/file-system/directory-removal-port.ts";
import type { EntryKindPort } from "../application/ports/file-system/entry-kind-port.ts";
import type { FileCreationPort } from "../application/ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import { createChecksRunner } from "../infrastructure/engines/eslint/runner/checks-runner/checks-runner.ts";
import { ESLINT_PROJECTED_KINDS } from "../infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts";
import { createEslintPort } from "../infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  loadEslintToolchain,
} from "../infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { toolchainBoundNamedChecksRunner } from "../infrastructure/engines/protocol/toolchain/toolchain-bound-runner.ts";
import { createWalkerRunner } from "../infrastructure/engines/walker/runner/create-walker-runner.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { createDefaultFileRemovalPort } from "../infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { installFormOf } from "../infrastructure/node/modules/install-layout.ts";
import { createDefaultModuleLoaderPort } from "../infrastructure/node/modules/module-loader-port.ts";
import type { PackageLocationPort } from "../infrastructure/node/modules/package-location-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import { versionTwoCheckOf } from "../operations/check/version-two-check-command.ts";
import { installedPortsOver } from "./installed-ports.ts";
import { versionTwoStagesOver } from "./version-two-stages.ts";

const ABSENT_ENTRY_KIND: EntryKindPort = { kindOf: () => "absent" };

const slashed = (text: string): string => text.replaceAll("\\", "/");

const overlaidFileText = (request: {
  readonly base: FileTextPort;
  readonly files: Readonly<Record<string, string>>;
}): FileTextPort => {
  const overlaid = (requested: string): string | undefined =>
    Object.entries(request.files).find(([name]) => slashed(name) === slashed(requested))?.[1];
  return {
    ...request.base,
    read: (reading) => {
      const text = overlaid(reading.path);
      return text === undefined ? request.base.read(reading) : { outcome: "ok", value: text };
    },
    exists: (probing) =>
      overlaid(probing.path) === undefined ? request.base.exists(probing) : "present",
  };
};

const modulesServingRunner = (request: {
  readonly runnerSuffix: string;
  readonly runner: unknown;
  readonly base: ModuleLoaderPort;
}): ModuleLoaderPort => ({
  load: (load) =>
    load.path.replaceAll("\\", "/").endsWith(request.runnerSuffix)
      ? Promise.resolve({ outcome: "ok", value: { namedChecksRunner: request.runner } })
      : request.base.load(load),
});

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/../..` });

const REPO_ROOT = resolvedPath({
  path: `${INSTALL_ROOT}/in-memory-single-mechanism-repository`,
});

const NAMING_CONVENTION = {
  name: "naming-convention",
  symptom: expect.objectContaining({ name: "name-off-its-casing" }),
};

const repositoryFiles = (request: { readonly checks: Readonly<Record<string, string>> }) =>
  overlaidFileText({
    base: createDefaultFileTextPort({}),
    files: {
      [`${REPO_ROOT}/hone.config.json`]: JSON.stringify({
        version: 2,
        ruleSets: {},
        checks: request.checks,
      }),
      [`${REPO_ROOT}/src/greeting.ts`]:
        "export const greetingFor = (visitorName: string): string => visitorName.trim();\n",
    },
  });

const NOT_RUNNING_NAMING_CONVENTION = repositoryFiles({
  checks: {
    "shorthand-name#identifier-names": "walker",
    "name-off-its-casing#naming-convention": "not-run",
  },
});

const NOT_ADOPTING_NAMING_CONVENTION = repositoryFiles({
  checks: {
    "shorthand-name#identifier-names": "walker",
    "name-off-its-casing#naming-convention": "not-adopted",
  },
});

const RUNNING_NAMING_CONVENTION = repositoryFiles({
  checks: {
    "shorthand-name#identifier-names": "walker",
    "name-off-its-casing#naming-convention": "eslint",
  },
});

const WALKER_ONLY = repositoryFiles({
  checks: {
    "shorthand-name#identifier-names": "walker",
    "name-off-its-casing#filename-case": "not-adopted",
  },
});

const git: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
    outcome: "ok",
    value: [repoPathOf("hone.config.json"), repoPathOf("src/greeting.ts")],
  }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
};

const eslintNotInstalled: PackageLocationPort = {
  installRoot: INSTALL_ROOT,
  installForm: "package",
  locate: vi.fn<PackageLocationPort["locate"]>().mockThrow(
    Object.assign(new Error(`Cannot find package 'eslint' imported from ${INSTALL_ROOT}/x.ts`), {
      code: "ERR_MODULE_NOT_FOUND",
    }),
  ),
};

const eslintRunnerWithoutPeersOver = (request: { readonly fileText: FileTextPort }) =>
  toolchainBoundNamedChecksRunner({
    fileScope: "tracked",
    toolchain: loadEslintToolchain({
      peers: {
        modules: defaultEslintToolchainPeers({ installRoot: INSTALL_ROOT, installForm: "source" })
          .modules,
        location: eslintNotInstalled,
      },
    }),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createChecksRunner({
        fileText: request.fileText,
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: createDefaultModuleLoaderPort({}),
        path,
        eslint: createEslintPort({ toolchain }),
        moduleExtension: ".ts",
      }),
  });

const walkerRunnerOver = (request: { readonly fileText: FileTextPort }) =>
  toolchainBoundNamedChecksRunner({
    fileScope: "typescript",
    toolchain: loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: INSTALL_ROOT,
        installForm: installFormOf({ moduleExtension: ".ts" }),
      }),
    }),
    projectedKinds: ["inline-disable"],
    runnerOf: (parse) =>
      createWalkerRunner({
        fileText: request.fileText,
        modules: createDefaultModuleLoaderPort({}),
        path,
        parse,
        entryKind: ABSENT_ENTRY_KIND,
      }),
  });

const modulesServing = (request: {
  readonly eslintRunner: unknown;
  readonly fileText: FileTextPort;
}): ModuleLoaderPort =>
  modulesServingRunner({
    runnerSuffix: "/src/infrastructure/engines/eslint/runner/runner.ts",
    runner: request.eslintRunner,
    base: modulesServingRunner({
      runnerSuffix: "/src/infrastructure/engines/walker/runner/runner.ts",
      runner: walkerRunnerOver({ fileText: request.fileText }),
      base: createDefaultModuleLoaderPort({}),
    }),
  });

const peerlessEslintOver = (request: { readonly fileText: FileTextPort }): ModuleLoaderPort =>
  modulesServing({
    eslintRunner: eslintRunnerWithoutPeersOver(request),
    fileText: request.fileText,
  });

const unloadableEslintOver = (request: { readonly fileText: FileTextPort }): ModuleLoaderPort =>
  modulesServing({ eslintRunner: undefined, fileText: request.fileText });

const checkOf = (request: {
  readonly modules: ModuleLoaderPort;
  readonly fileText: FileTextPort;
}) =>
  versionTwoCheckOf({
    stages: versionTwoStagesOver({
      ports: installedPortsOver({
        path,
        fileText: request.fileText,
        modules: request.modules,
        git,
        gitTree: {
          pathsAt: vi.fn<GitTreePort["pathsAt"]>().mockReturnValue({ outcome: "ok", value: [] }),
        },
        directory: createDefaultDirectoryPort({}),
        fileCreation: { createNew: vi.fn<FileCreationPort["createNew"]>() },
        fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
        directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>() },
        entryKind: ABSENT_ENTRY_KIND,
      }),
      locations: {
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        moduleExtension: ".ts",
        baseRevision: undefined,
      },
    }),
    arguments: { reportOutput: undefined, forfeiture: undefined },
  });

const WHOLE_WALKER_ONLY_REPORT = {
  findings: [],
  stale: [],
  refused: [],
  unmeasured: [],
  assessment: [],
};

describe("adopting named checks with an ESLint check adopted but not run, and no ESLint installed", () => {
  it("passes as a whole assessment with no ESLint peer resolvable, listing the check as not run", async () => {
    expect(
      await checkOf({
        modules: peerlessEslintOver({
          fileText: NOT_RUNNING_NAMING_CONVENTION,
        }),
        fileText: NOT_RUNNING_NAMING_CONVENTION,
      }),
    ).toEqual({
      outcome: "ok",
      value: expect.objectContaining({
        report: expect.objectContaining({
          ...WHOLE_WALKER_ONLY_REPORT,
          "not-adopted": [],
          "not-run": [expect.objectContaining(NAMING_CONVENTION)],
        }),
      }),
    });
  });

  it("never loads the ESLint mechanism's module", async () => {
    expect(
      await checkOf({
        modules: unloadableEslintOver({
          fileText: NOT_RUNNING_NAMING_CONVENTION,
        }),
        fileText: NOT_RUNNING_NAMING_CONVENTION,
      }),
    ).toEqual({
      outcome: "ok",
      value: expect.objectContaining({
        report: expect.objectContaining({
          ...WHOLE_WALKER_ONLY_REPORT,
          "not-run": [expect.objectContaining(NAMING_CONVENTION)],
        }),
      }),
    });
  });
});

describe("adopting named checks with an ESLint check not adopted, and no ESLint installed", () => {
  it("passes as a whole assessment with no ESLint peer, listing the check as not adopted", async () => {
    expect(
      await checkOf({
        modules: unloadableEslintOver({
          fileText: NOT_ADOPTING_NAMING_CONVENTION,
        }),
        fileText: NOT_ADOPTING_NAMING_CONVENTION,
      }),
    ).toEqual({
      outcome: "ok",
      value: expect.objectContaining({
        report: expect.objectContaining({
          ...WHOLE_WALKER_ONLY_REPORT,
          "not-adopted": [expect.objectContaining(NAMING_CONVENTION)],
          "not-run": [],
        }),
      }),
    });
  });
});

describe("an ESLint check in named settings, and no ESLint installed", () => {
  it("fails when the ESLint check runs, because the ESLint mechanism needs its peers", async () => {
    expect(
      await checkOf({
        modules: peerlessEslintOver({ fileText: RUNNING_NAMING_CONVENTION }),
        fileText: RUNNING_NAMING_CONVENTION,
      }),
    ).toMatchObject({
      outcome: "failed",
      error: {
        kind: "engine-failed",
        engine: { named: "engine", engine: { name: "eslint" } },
        failure: {
          kind: "toolchain-unavailable",
          peers: [
            { packageName: "eslint" },
            { packageName: "@typescript-eslint/parser" },
            { packageName: "@typescript-eslint/eslint-plugin" },
          ],
        },
      },
    });
  });

  it("lists an omitted sibling check as available without loading ESLint", async () => {
    expect(
      await checkOf({
        modules: unloadableEslintOver({ fileText: WALKER_ONLY }),
        fileText: WALKER_ONLY,
      }),
    ).toMatchObject({
      outcome: "ok",
      value: { report: { findings: [], available: [expect.objectContaining(NAMING_CONVENTION)] } },
    });
  });
});
