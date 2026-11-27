import { describe, expect, it, vi } from "vitest";

import type { RunnerModuleOf } from "../application/ports/engine/runner-location.ts";
import type { DirectoryRemovalPort } from "../application/ports/file-system/directory-removal-port.ts";
import type { EntryKindPort } from "../application/ports/file-system/entry-kind-port.ts";
import type { FileCreationPort } from "../application/ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleLoad } from "../application/ports/host/module-loader-port.ts";
import type { SettingsSourcesOf } from "../application/ports/settings-sources.ts";
import type { VersionTwoStages } from "../application/run/version-two-run.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import type { EngineId } from "../domain/rule-set/identifier-types.ts";
import { absolutePathSchema } from "../infrastructure/content-files/absolute-path.ts";
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
import { createSettingsSources } from "../infrastructure/hone-config-file/settings-sources.ts";
import { createDefaultFileRemovalPort } from "../infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { installFormOf } from "../infrastructure/node/modules/install-layout.ts";
import { createDefaultModuleLoaderPort } from "../infrastructure/node/modules/module-loader-port.ts";
import type { PackageLocationPort } from "../infrastructure/node/modules/package-location-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import { versionTwoCheckOf } from "../operations/check/version-two-check-command.ts";
import { installedPortsOver } from "./installed-ports.ts";
import { runnerEnginesOver } from "./runner-engines.ts";
import { versionTwoStagesOver } from "./version-two-stages.ts";

const ABSENT_ENTRY_KIND: EntryKindPort = { kindOf: () => "absent" };

const path = createDefaultPathPort({});
const INSTALL_ROOT = absolutePathSchema.parse(
  path.join({ segments: [import.meta.dirname, "../.."] }),
);
const REPO_ROOT = absolutePathSchema.parse(
  path.join({ segments: [INSTALL_ROOT, "in-memory-single-mechanism-repository"] }),
);

const NAMING_CONVENTION = {
  name: "naming-convention",
  symptom: expect.objectContaining({ name: "name-off-its-casing" }),
};

const NOT_RUNNING_NAMING_CONVENTION = `{
  "version": 2,
  "ruleSets": {},
  "checks": {
    "shorthand-name#identifier-names": "walker",
    "name-off-its-casing#naming-convention": "not-run"
  }
}`;

const NOT_ADOPTING_NAMING_CONVENTION = `{
  "version": 2,
  "ruleSets": {},
  "checks": {
    "shorthand-name#identifier-names": "walker",
    "name-off-its-casing#naming-convention": "not-adopted"
  }
}`;

const RUNNING_NAMING_CONVENTION = `{
  "version": 2,
  "ruleSets": {},
  "checks": {
    "shorthand-name#identifier-names": "walker",
    "name-off-its-casing#naming-convention": "eslint"
  }
}`;

const WALKER_ONLY = `{
  "version": 2,
  "ruleSets": {},
  "checks": {
    "shorthand-name#identifier-names": "walker",
    "name-off-its-casing#filename-case": "not-adopted"
  }
}`;

const TRACKED = [repoPathOf("hone.config.json"), repoPathOf("src/greeting.ts")];

const disk = createDefaultFileTextPort({});

const SOURCE_FILES: FileTextPort = {
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({
    outcome: "ok",
    value: "export const greetingFor = (visitorName: string): string => visitorName.trim();\n",
  }),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
};

const createFixtureSettings =
  (text: string): SettingsSourcesOf =>
  (options) => ({
    ...createSettingsSources(options),
    settingsFile: createSettingsSources({
      ...options,
      fileText: {
        read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: text }),
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
        write: vi.fn<FileTextPort["write"]>(),
      },
    }).settingsFile,
  });

const git: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
    outcome: "ok",
    value: TRACKED,
  }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
};

const eslintNotInstalled: PackageLocationPort = {
  installRoot: INSTALL_ROOT,
  installForm: "package",
  locate: vi.fn<PackageLocationPort["locate"]>().mockReturnValue({
    outcome: "failed",
    error: { kind: "not-a-file-url", url: "missing-peer", detail: "package is not installed" },
  }),
};

const createEslintRunnerWithoutPeers = () =>
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
        fileText: SOURCE_FILES,
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: createDefaultModuleLoaderPort({}),
        path,
        eslint: createEslintPort({ toolchain }),
        moduleExtension: ".ts",
      }),
  });

const createFixtureWalker = () =>
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
        fileText: SOURCE_FILES,
        modules: createDefaultModuleLoaderPort({}),
        path,
        parse,
        entryKind: ABSENT_ENTRY_KIND,
      }),
  });

const ESLINT_UNLOADABLE: ModuleLoad = {
  outcome: "failed",
  error: {
    kind: "module-unloadable",
    path: "eslint/runner.ts",
    detail: "ESLint runner is unavailable to the fixture",
  },
};

const ESLINT_WITHOUT_PEERS: ModuleLoad = {
  outcome: "ok",
  value: { namedChecksRunner: createEslintRunnerWithoutPeers() },
};

const createFixtureRunnerLoader = (eslint: ModuleLoad): RunnerModuleOf => {
  const replies: Readonly<Record<EngineId, ModuleLoad>> = {
    walker: { outcome: "ok", value: { namedChecksRunner: createFixtureWalker() } },
    eslint,
  };
  return async ({ mechanism }) => replies[mechanism];
};

const fixturePorts = installedPortsOver({
  path,
  fileText: disk,
  modules: createDefaultModuleLoaderPort({}),
  git,
  gitTree: {
    pathsAt: vi.fn<GitTreePort["pathsAt"]>().mockReturnValue({ outcome: "ok", value: [] }),
  },
  directory: createDefaultDirectoryPort({}),
  fileCreation: { createNew: vi.fn<FileCreationPort["createNew"]>() },
  fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
  directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>() },
  entryKind: ABSENT_ENTRY_KIND,
});

const checkOf = (request: { readonly eslint: ModuleLoad; readonly settings: string }) => {
  const stages = versionTwoStagesOver({
    ports: {
      ...fixturePorts,
      ...runnerEnginesOver({ runnerModuleOf: createFixtureRunnerLoader(request.eslint) }),
      settingsSourcesOf: createFixtureSettings(request.settings),
    },
    locations: {
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
      moduleExtension: ".ts",
      baseRevision: undefined,
    },
  });
  return versionTwoCheckOf({
    stages: {
      ...stages,
      tree: vi.fn<VersionTwoStages["tree"]>().mockReturnValue({
        outcome: "ok",
        value: { tracked: TRACKED, declaredConfigRoots: [] },
      }),
    },
    arguments: { reportOutput: undefined, forfeiture: undefined },
  });
};

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
        eslint: ESLINT_WITHOUT_PEERS,
        settings: NOT_RUNNING_NAMING_CONVENTION,
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
        eslint: ESLINT_UNLOADABLE,
        settings: NOT_RUNNING_NAMING_CONVENTION,
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
        eslint: ESLINT_UNLOADABLE,
        settings: NOT_ADOPTING_NAMING_CONVENTION,
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
        eslint: ESLINT_WITHOUT_PEERS,
        settings: RUNNING_NAMING_CONVENTION,
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
        eslint: ESLINT_UNLOADABLE,
        settings: WALKER_ONLY,
      }),
    ).toMatchObject({
      outcome: "ok",
      value: { report: { findings: [], available: [expect.objectContaining(NAMING_CONVENTION)] } },
    });
  });
});
