import { assert, describe, expect, it, vi } from "vitest";
import type { DirectoryPort } from "../application/ports/file-system/directory-port.ts";
import type { DirectoryRemovalPort } from "../application/ports/file-system/directory-removal-port.ts";
import type { FileCreationPort } from "../application/ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../application/ports/file-system/file-removal-port.ts";
import type { EntryKindPort } from "../application/ports/file-system/entry-kind-port.ts";
import {
  toolchainBoundEmbeddedRunner,
  toolchainBoundStandaloneRunner,
} from "../infrastructure/engines/protocol/toolchain/toolchain-bound-runner.ts";
import { createDefaultFileRemovalPort } from "../infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../infrastructure/node/modules/module-loader-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { PackageLocationPort } from "../infrastructure/node/modules/package-location-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import { installFormOf } from "../infrastructure/node/modules/install-layout.ts";
import { createWalkerRunner } from "../infrastructure/engines/audit/runner/create-walker-runner.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../infrastructure/engines/audit/runner/toolchain/typescript-toolchain.ts";
import {
  createEslintRunner,
  ESLINT_PROJECTED_KINDS,
} from "../infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts";
import { createEslintPort } from "../infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "../infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { checkRunAt } from "./check-command.ts";
import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";
import { installedPortsOver } from "./installed-ports.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";

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
    exists: (probing) => (overlaid(probing.path) === undefined ? request.base.exists(probing) : "present"),
  };
};

const modulesServingRunner = (request: {
  readonly runnerSuffix: string;
  readonly runner: unknown;
  readonly base: ModuleLoaderPort;
}): ModuleLoaderPort => ({
  load: (load) =>
    load.path.replaceAll("\\", "/").endsWith(request.runnerSuffix)
      ? Promise.resolve({ outcome: "ok", value: { runner: request.runner } })
      : request.base.load(load),
});

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(
    resolved.outcome === "ok",
    `${request.path} resolves to an absolute path`,
  );
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/../..` });

const REPO_ROOT = resolvedPath({
  path: `${INSTALL_ROOT}/in-memory-single-mechanism-repository`,
});

const NAMING_CONVENTION = {
  ruleSet: "hone",
  discipline: "CD-6",
  clause: "naming-convention",
} as const;

const repositoryFiles = (request: {
  readonly clauses: Readonly<Record<string, string>>;
}) =>
  overlaidFileText({
    base: createDefaultFileTextPort({}),
    files: {
      [`${REPO_ROOT}/disciplines.json`]: JSON.stringify({
        version: 1,
        ruleSets: {},
        clauses: request.clauses,
      }),
      [`${REPO_ROOT}/discipline-exceptions.json`]: JSON.stringify({
        version: 1,
        exceptions: [],
      }),
      [`${REPO_ROOT}/src/greeting.ts`]:
        "export const greetingFor = (visitorName: string): string => visitorName.trim();\n",
    },
  });

const NOT_RUNNING_NAMING_CONVENTION = repositoryFiles({
  clauses: {
    "CD-6#identifier-names": "audit",
    "CD-6#naming-convention": "not-run",
  },
});

const NOT_ADOPTING_NAMING_CONVENTION = repositoryFiles({
  clauses: {
    "CD-6#identifier-names": "audit",
    "CD-6#naming-convention": "not-adopted",
  },
});

const RUNNING_NAMING_CONVENTION = repositoryFiles({
  clauses: {
    "CD-6#identifier-names": "audit",
    "CD-6#naming-convention": "eslint",
  },
});

const AUDIT_ONLY = repositoryFiles({
  clauses: { "CD-6#identifier-names": "audit" },
});

const git: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
    outcome: "ok",
    value: [
      repoPathOf("discipline-exceptions.json"),
      repoPathOf("disciplines.json"),
      repoPathOf("src/greeting.ts"),
    ],
  }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
};

const eslintNotInstalled: PackageLocationPort = {
  installRoot: INSTALL_ROOT,
  installForm: "package",
  locate: vi
    .fn<PackageLocationPort["locate"]>()
    .mockThrow(
      Object.assign(
        new Error(
          `Cannot find package 'eslint' imported from ${INSTALL_ROOT}/x.ts`,
        ),
        { code: "ERR_MODULE_NOT_FOUND" },
      ),
    ),
};

const eslintRunnerWithoutPeersOver = (request: {
  readonly fileText: FileTextPort;
}) =>
  toolchainBoundEmbeddedRunner({
    toolchain: loadEslintToolchain({
      peers: {
        modules: defaultEslintToolchainPeers({ installRoot: INSTALL_ROOT, installForm: "source" }).modules,
        location: eslintNotInstalled,
      },
    }),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createEslintRunner({
        fileText: request.fileText,
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: createDefaultModuleLoaderPort({}),
        path,
        eslint: createEslintPort({ toolchain }),
        moduleExtension: ".ts",
      }),
  });

const auditRunnerOver = (request: { readonly fileText: FileTextPort }) =>
  toolchainBoundStandaloneRunner({
    toolchain: loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: INSTALL_ROOT,
        installForm: installFormOf({ moduleExtension: ".ts" }),
      }),
    }),
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
      runnerSuffix: "/src/infrastructure/engines/audit/runner/runner.ts",
      runner: auditRunnerOver({ fileText: request.fileText }),
      base: createDefaultModuleLoaderPort({}),
    }),
  });

const peerlessEslintOver = (request: {
  readonly fileText: FileTextPort;
}): ModuleLoaderPort =>
  modulesServing({
    eslintRunner: eslintRunnerWithoutPeersOver(request),
    fileText: request.fileText,
  });

const unloadableEslintOver = (request: {
  readonly fileText: FileTextPort;
}): ModuleLoaderPort =>
  modulesServing({ eslintRunner: undefined, fileText: request.fileText });

const checkOf = (request: {
  readonly modules: ModuleLoaderPort;
  readonly fileText: FileTextPort;
}) =>
  checkRunAt({
    ...installedPortsOver({
      path,
      fileText: request.fileText,
      modules: request.modules,
      engine: createDefaultEnginePort({}),
      git,
      gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>().mockReturnValue({ outcome: "ok", value: [] }) },
      directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
      fileCreation: { createNew: vi.fn<FileCreationPort["createNew"]>() },
      fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
      directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>() },
      entryKind: ABSENT_ENTRY_KIND,
    }),
    moduleUrl: new URL("../hone.ts", import.meta.url).href,
    locations: {
      arguments: { repo: REPO_ROOT, baseRevision: undefined, reportOutput: undefined, forfeiture: undefined },
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
    },
  });

const WHOLE_AUDIT_ONLY_REPORT = {
  findings: [],
  stale: [],
  uncovered: [],
  invalidRecords: [],
  unmeasured: [],
  assessment: [],
  readFirst: [],
};

describe("adopting CD-6 with its ESLint clause adopted but not run, and no ESLint installed", () => {
  it("passes as a whole assessment with no ESLint peer resolvable, listing the clause as not run", async () => {
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
        report: expect.objectContaining({ ...WHOLE_AUDIT_ONLY_REPORT, notAdopted: [], notRun: [NAMING_CONVENTION] }),
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
        report: expect.objectContaining({ ...WHOLE_AUDIT_ONLY_REPORT, notRun: [NAMING_CONVENTION] }),
      }),
    });
  });
});

describe("adopting CD-6 with its ESLint clause not adopted, and no ESLint installed", () => {
  it("passes as a whole assessment with no ESLint peer, listing the clause as not adopted", async () => {
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
        report: expect.objectContaining({ ...WHOLE_AUDIT_ONLY_REPORT, notAdopted: [NAMING_CONVENTION], notRun: [] }),
      }),
    });
  });
});

describe("adopting CD-6 without stating its ESLint clause, and no ESLint installed", () => {
  it("fails when the ESLint clause runs, because the ESLint mechanism needs its peers", async () => {
    expect(
      await checkOf({
        modules: peerlessEslintOver({ fileText: RUNNING_NAMING_CONVENTION }),
        fileText: RUNNING_NAMING_CONVENTION,
      }),
    ).toMatchObject({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "eslint",
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

  it("reports the ESLint clause uncovered when clauses leaves it out", async () => {
    expect(
      await checkOf({
        modules: peerlessEslintOver({ fileText: AUDIT_ONLY }),
        fileText: AUDIT_ONLY,
      }),
    ).toMatchObject({
      outcome: "ok",
      value: { report: { findings: [], uncovered: [NAMING_CONVENTION] } },
    });
  });
});
