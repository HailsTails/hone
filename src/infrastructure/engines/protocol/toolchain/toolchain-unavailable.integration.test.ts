import { assert, describe, expect, it, vi } from "vitest";

import type { RunRequest } from "../../../../application/ports/engine/runner-module.ts";
import type { EntryKindPort } from "../../../../application/ports/file-system/entry-kind-port.ts";
import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { createDefaultFileRemovalPort } from "../../../node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import type { PackageLocationPort } from "../../../node/modules/package-location-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import { loadFailureText } from "../../../printed-report/load-failures/load-failure-text.ts";
import {
  createEslintRunner,
  ESLINT_PROJECTED_KINDS,
} from "../../eslint/runner/embedded-runner/create-eslint-runner.ts";
import { createEslintPort } from "../../eslint/runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  loadEslintToolchain,
} from "../../eslint/runner/toolchain/eslint-toolchain.ts";
import { createWalkerRunner } from "../../walker/runner/create-walker-runner.ts";
import { defaultTypeScriptModules } from "../../walker/runner/toolchain/typescript-parse.ts";
import { loadParsePort } from "../../walker/runner/toolchain/typescript-toolchain.ts";
import type { EmbeddedRunRequest } from "../embedded/embedded-runner-module-schema.ts";
import {
  toolchainBoundEmbeddedRunner,
  toolchainBoundNamedChecksRunner,
} from "./toolchain-bound-runner.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../..`);

const ESLINT = "eslint" as const;

const AUDIT = "walker" as const;

const REPO = absoluteRootOf("/repository");

const ABSENT_ENTRY_KIND: EntryKindPort = { kindOf: () => "absent" };

const DEVELOPMENT_ESLINT_MODULES = defaultEslintToolchainPeers({
  installRoot: INSTALL_ROOT,
  installForm: "source",
}).modules;

const RUN: RunRequest = {
  repoRoot: REPO,
  installRoot: INSTALL_ROOT,
  files: [],
  trackedPaths: [],
  clauses: [],
};

const EMBEDDED_RUN: EmbeddedRunRequest = { ...RUN, declaredConfigRoots: [], records: [] };

const fileText = createDefaultFileTextPort({});

const path = createDefaultPathPort({});

const TYPESCRIPT_NOT_INSTALLED: NodeJS.ErrnoException = new Error(
  "Cannot find package 'typescript' imported from /install/x.ts",
);
TYPESCRIPT_NOT_INSTALLED.code = "ERR_MODULE_NOT_FOUND";

const ESLINT_NOT_INSTALLED: NodeJS.ErrnoException = new Error(
  "Cannot find package 'eslint' imported from /install/x.ts",
);
ESLINT_NOT_INSTALLED.code = "ERR_MODULE_NOT_FOUND";

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
  locate: (locate) => ({
    outcome: "ok",
    value: `${INSTALL_ROOT}/node_modules/${locate.packageName}/lib/api.js`,
  }),
};

const eslintRunnerLocatingBy = (request: {
  readonly pieces: ModuleLoaderPort;
  readonly location: PackageLocationPort;
}) =>
  toolchainBoundEmbeddedRunner({
    toolchain: loadEslintToolchain({
      peers: { modules: DEVELOPMENT_ESLINT_MODULES, location: request.location },
    }),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createEslintRunner({
        fileText,
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: request.pieces,
        path,
        eslint: createEslintPort({ toolchain }),
        moduleExtension: ".ts",
      }),
  });

const auditRunnerWithoutTypescript = (request: { readonly pieces: ModuleLoaderPort }) =>
  toolchainBoundNamedChecksRunner({
    fileScope: "tracked",
    projectedKinds: [],
    toolchain: loadParsePort({
      peers: {
        modules: defaultTypeScriptModules,
        location: unresolvedFirst({ notInstalled: TYPESCRIPT_NOT_INSTALLED }),
      },
    }),
    runnerOf: (parse) =>
      createWalkerRunner({
        fileText,
        modules: request.pieces,
        path,
        parse,
        entryKind: ABSENT_ENTRY_KIND,
      }),
  });

describe("a run whose adopter has not installed a toolchain peer the selected mechanism needs", () => {
  it("fails the ESLint mechanism as toolchain-unavailable naming eslint and its supported range, before loading any piece", async () => {
    const pieces = pieceLoads();
    const ran = await eslintRunnerLocatingBy({
      pieces,
      location: unresolvedFirst({ notInstalled: ESLINT_NOT_INSTALLED }),
    }).run(EMBEDDED_RUN);
    expect({ ran, pieceLoads: vi.mocked(pieces.load).mock.calls }).toEqual({
      ran: {
        outcome: "failed",
        error: {
          kind: "toolchain-unavailable",
          peers: [
            {
              packageName: "eslint",
              peer: "optional",
              supported: "^9.39.5 || ^10.15.0",
              found: "not installed",
            },
          ],
        },
      },
      pieceLoads: [],
    });
  });

  it("prints that failure as one load-failure line telling the adopter what to add, never a stack trace", async () => {
    const ran = await eslintRunnerLocatingBy({
      pieces: pieceLoads(),
      location: unresolvedFirst({ notInstalled: ESLINT_NOT_INSTALLED }),
    }).run(EMBEDDED_RUN);
    assert(ran.outcome === "failed", "the run fails to load");
    expect(
      loadFailureText({
        failure: { kind: "runner-failed", mechanism: ESLINT, failure: ran.error },
      }),
    ).toBe(
      "load failure: runner-failed eslint toolchain-unavailable eslint found not installed, supported ^9.39.5 || ^10.15.0: add a supported version to the devDependencies of the repository root\n",
    );
  });

  it("fails the audit mechanism as toolchain-unavailable naming typescript, before loading any piece", async () => {
    const pieces = pieceLoads();
    const ran = await auditRunnerWithoutTypescript({ pieces }).run({
      ...RUN,
      bindings: [],
      answered: [],
      declaredConfigRoots: [],
      declaredConfigLookup: undefined,
      projectionKind: "mjs",
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    });
    expect({ ran, pieceLoads: vi.mocked(pieces.load).mock.calls }).toEqual({
      ran: {
        outcome: "failed",
        error: {
          kind: "toolchain-unavailable",
          peers: [
            {
              packageName: "typescript",
              peer: "required",
              supported: ">=4.8.4 <7.0.0",
              found: "not installed",
            },
          ],
        },
      },
      pieceLoads: [],
    });
  });

  it("fails the ESLint mechanism as toolchain-shadowed when eslint resolves from inside the core install, and prints what to delete", async () => {
    const pieces = pieceLoads();
    const ran = await eslintRunnerLocatingBy({ pieces, location: shadowedEslint }).run(
      EMBEDDED_RUN,
    );
    assert(ran.outcome === "failed", "the run fails to load");
    expect({
      printed: loadFailureText({
        failure: { kind: "runner-failed", mechanism: ESLINT, failure: ran.error },
      }),
      pieceLoads: vi.mocked(pieces.load).mock.calls,
    }).toEqual({
      printed: `load failure: runner-failed eslint toolchain-shadowed eslint resolved from ${INSTALL_ROOT}/node_modules/eslint/lib/api.js inside the core install ${INSTALL_ROOT}: delete ${INSTALL_ROOT}/node_modules, then reinstall the package with the repository's package manager, so the repository's own copy is used\n`,
      pieceLoads: [],
    });
  });
});

describe("a run whose adopter's install is missing the required peer typescript", () => {
  it("prints a missing typescript as an incomplete install, since typescript is a required peer", async () => {
    const ran = await auditRunnerWithoutTypescript({ pieces: pieceLoads() }).run({
      ...RUN,
      bindings: [],
      answered: [],
      declaredConfigRoots: [],
      declaredConfigLookup: undefined,
      projectionKind: "mjs",
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    });
    assert(
      ran.outcome === "failed" && ran.error.kind === "toolchain-unavailable",
      "the TypeScript toolchain fails to load",
    );
    expect(
      loadFailureText({ failure: { kind: "runner-failed", mechanism: AUDIT, failure: ran.error } }),
    ).toBe(
      "load failure: runner-failed audit toolchain-unavailable typescript found not installed, supported >=4.8.4 <7.0.0: typescript is a required peer of @hailstails/hone, so this install is incomplete; add a supported version to the devDependencies of the repository root and reinstall\n",
    );
  });
});
