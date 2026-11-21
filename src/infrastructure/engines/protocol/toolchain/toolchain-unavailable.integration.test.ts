import { assert, describe, expect, it, vi } from "vitest";
import { runCheck } from "../../../../application/run/check/run-check.ts";
import { createSelectionRepository, type SelectionRepository } from "../../../disciplines-file/consumer-selection.ts";
import { createExceptionRepository } from "../../../discipline-exceptions-folder/exception-layout.ts";
import type { ExceptionRepository } from "../../../discipline-exceptions-folder/exception-records.ts";
import type { EntryKindPort } from "../../../node/file-system/file-system-port.ts";
import type { ModuleExtension } from "../../../node/modules/install-layout.ts";
import { loadFailureText } from "../../../printed-report/load-failures/load-failure-text.ts";
import { toolchainBoundEmbeddedRunner, toolchainBoundStandaloneRunner } from "./toolchain-bound-runner.ts";
import { createDefaultFileRemovalPort } from "../../../node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../../../node/file-system/file-text-port.ts";
import type { GitPort } from "../../../git/git-port.ts";
import type { PackageLocationPort } from "../../../node/modules/package-location-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort, type PathPort } from "../../../node/path-port.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import type { AbsolutePath } from "../../../../domain/repository/absolute-path-types.ts";
import { DEFAULT_ASSESSMENT } from "../../../hone-config-file/assessment.ts";
import { type RepoPath, repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { createWalkerRunner } from "../../audit/runner/create-walker-runner.ts";
import { defaultTypeScriptModules } from "../../audit/runner/toolchain/typescript-parse.ts";
import { loadParsePort } from "../../audit/runner/toolchain/typescript-toolchain.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "../../eslint/runner/embedded-runner/create-eslint-runner.ts";
import { createEslintPort } from "../../eslint/runner/toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "../../eslint/runner/toolchain/eslint-toolchain.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../..`);

const ABSENT_ENTRY_KIND: EntryKindPort = { kindOf: () => "absent" };

const DEVELOPMENT_ESLINT_MODULES = defaultEslintToolchainPeers({ installRoot: INSTALL_ROOT, installForm: "source" }).modules;

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

const SINGLE_FILE = repoPathSchema.parse("discipline-exceptions.json");

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
    gitTree: { pathsAt: () => ({ outcome: "ok", value: [SINGLE_FILE] }) },
  });

type DiskRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly git: GitPort;
};

const withSingleFileRecords = <Request extends DiskRequest>(
  request: Request,
): Request & { readonly selectionRepository: SelectionRepository; readonly exceptionRepository: ExceptionRepository } => ({
  ...request,
  selectionRepository: createSelectionRepository(request),
  exceptionRepository: singleFileRepositoryOver(request),
});

const fileText = createDefaultFileTextPort({});

const path = createDefaultPathPort({});

const TYPESCRIPT_NOT_INSTALLED: NodeJS.ErrnoException = new Error("Cannot find package 'typescript' imported from /install/x.ts");
TYPESCRIPT_NOT_INSTALLED.code = "ERR_MODULE_NOT_FOUND";

const ESLINT_NOT_INSTALLED: NodeJS.ErrnoException = new Error("Cannot find package 'eslint' imported from /install/x.ts");
ESLINT_NOT_INSTALLED.code = "ERR_MODULE_NOT_FOUND";

const gitTracking = (request: { readonly tracked: readonly RepoPath[] }): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: request.tracked }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const pieceLoads = (): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>(),
});

const unresolvedFirst = (request: { readonly notInstalled: Error }): PackageLocationPort => ({
  installRoot: INSTALL_ROOT,
  installForm: "package",
  locate: vi
    .fn<PackageLocationPort["locate"]>()
    .mockThrowOnce(request.notInstalled)
    .mockReturnValue({ outcome: "ok", value: "/repository/node_modules/peer/index.js" }),
});

const shadowedEslint: PackageLocationPort = {
  installRoot: INSTALL_ROOT,
  installForm: "package",
  locate: (locate) => ({ outcome: "ok", value: `${INSTALL_ROOT}/node_modules/${locate.packageName}/lib/api.js` }),
};

const eslintRunnerLocatingBy = (request: { readonly pieces: ModuleLoaderPort; readonly location: PackageLocationPort }) =>
  toolchainBoundEmbeddedRunner({
    toolchain: loadEslintToolchain({ peers: { modules: DEVELOPMENT_ESLINT_MODULES, location: request.location } }),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createEslintRunner({ fileText, fileRemoval: createDefaultFileRemovalPort({}), modules: request.pieces, path, eslint: createEslintPort({ toolchain }), moduleExtension: ".ts" }),
  });

const auditRunnerWithoutTypescript = (request: { readonly pieces: ModuleLoaderPort }) =>
  toolchainBoundStandaloneRunner({
    toolchain: loadParsePort({ peers: { modules: defaultTypeScriptModules, location: unresolvedFirst({ notInstalled: TYPESCRIPT_NOT_INSTALLED }) } }),
    runnerOf: (parse) => createWalkerRunner({ fileText, modules: request.pieces, path, parse, entryKind: ABSENT_ENTRY_KIND }),
  });

const checkWith = (request: { readonly fixture: string; readonly runner: unknown; readonly tracked: readonly RepoPath[] }) =>
  runCheck(withSingleFileRecords({
    repoRoot: absolutePathSchema.parse(`${INSTALL_ROOT}/${request.fixture}`),
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    baseRevision: undefined,
    assessment: DEFAULT_ASSESSMENT,
    fileText,
    modules: modulesServingRunner({ runnerSuffix: "/runner/runner.ts", runner: request.runner, base: createDefaultModuleLoaderPort({}) }),
    path,
    git: gitTracking({ tracked: request.tracked }),
  }));

describe("a check whose adopter has not installed a toolchain peer the selected mechanism needs", () => {
  it("fails the ESLint mechanism as toolchain-unavailable naming eslint and its supported range, before loading any piece", async () => {
    const pieces = pieceLoads();
    const checked = await checkWith({
      fixture: "delivery/install-proof/consumer-proof/eslint",
      runner: eslintRunnerLocatingBy({ pieces, location: unresolvedFirst({ notInstalled: ESLINT_NOT_INSTALLED }) }),
      tracked: [repoPathSchema.parse("src/plain.ts")],
    });
    expect({ checked, pieceLoads: vi.mocked(pieces.load).mock.calls }).toEqual({
      checked: {
        outcome: "failed",
        error: {
          kind: "runner-failed",
          mechanism: "eslint",
          failure: { kind: "toolchain-unavailable", peers: [{ packageName: "eslint", peer: "optional", supported: "^9.39.5 || ^10.15.0", found: "not installed" }] },
        },
      },
      pieceLoads: [],
    });
  });

  it("prints that failure as one load-failure line telling the adopter what to add, never a stack trace", async () => {
    const checked = await checkWith({
      fixture: "delivery/install-proof/consumer-proof/eslint",
      runner: eslintRunnerLocatingBy({ pieces: pieceLoads(), location: unresolvedFirst({ notInstalled: ESLINT_NOT_INSTALLED }) }),
      tracked: [repoPathSchema.parse("src/plain.ts")],
    });
    assert(checked.outcome === "failed", "the check fails to load");
    expect(loadFailureText({ failure: checked.error })).toBe(
      "load failure: runner-failed eslint toolchain-unavailable eslint found not installed, supported ^9.39.5 || ^10.15.0: add a supported version to the devDependencies of the repository root\n",
    );
  });

  it("fails the audit mechanism as toolchain-unavailable naming typescript, before loading any piece", async () => {
    const pieces = pieceLoads();
    const checked = await checkWith({
      fixture: "delivery/install-proof/consumer-proof/audit",
      runner: auditRunnerWithoutTypescript({ pieces }),
      tracked: [repoPathSchema.parse("src/plain.ts")],
    });
    expect({ checked, pieceLoads: vi.mocked(pieces.load).mock.calls }).toEqual({
      checked: {
        outcome: "failed",
        error: {
          kind: "runner-failed",
          mechanism: "audit",
          failure: { kind: "toolchain-unavailable", peers: [{ packageName: "typescript", peer: "required", supported: ">=4.8.4 <7.0.0", found: "not installed" }] },
        },
      },
      pieceLoads: [],
    });
  });

  it("fails the ESLint mechanism as toolchain-shadowed when eslint resolves from inside the core install, and prints what to delete", async () => {
    const pieces = pieceLoads();
    const checked = await checkWith({
      fixture: "delivery/install-proof/consumer-proof/eslint",
      runner: eslintRunnerLocatingBy({ pieces, location: shadowedEslint }),
      tracked: [repoPathSchema.parse("src/plain.ts")],
    });
    assert(checked.outcome === "failed", "the check fails to load");
    expect({ printed: loadFailureText({ failure: checked.error }), pieceLoads: vi.mocked(pieces.load).mock.calls }).toEqual({
      printed: `load failure: runner-failed eslint toolchain-shadowed eslint resolved from ${INSTALL_ROOT}/node_modules/eslint/lib/api.js inside the core install ${INSTALL_ROOT}: delete ${INSTALL_ROOT}/node_modules, then reinstall the package with the repository's package manager, so the repository's own copy is used\n`,
      pieceLoads: [],
    });
  });
});

describe("a check whose adopter's install is missing the required peer typescript", () => {
  it("prints a missing typescript as an incomplete install, since typescript is a required peer", async () => {
    const checked = await checkWith({
      fixture: "delivery/install-proof/consumer-proof/audit",
      runner: auditRunnerWithoutTypescript({ pieces: pieceLoads() }),
      tracked: [repoPathSchema.parse("src/plain.ts")],
    });
    assert(checked.outcome === "failed", "the check fails to load");
    expect(loadFailureText({ failure: checked.error })).toBe(
      "load failure: runner-failed audit toolchain-unavailable typescript found not installed, supported >=4.8.4 <7.0.0: typescript is a required peer of @hailstails/hone, so this install is incomplete; add a supported version to the devDependencies of the repository root and reinstall\n",
    );
  });
});
