import { assert, describe, expect, it, vi } from "vitest";

import { checkConformanceOf } from "../application/conformance/check-conformance.ts";
import type { NamedConformancePort } from "../application/ports/engine/engine-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { CheckAddressText } from "../domain/language-layer/check-address-text.ts";
import { TOOL_RULE_SET } from "../domain/rule-set/clause-address.ts";
import { absolutePathSchema } from "../infrastructure/content-files/absolute-path.ts";
import { createNamedCheckExamplesRepository } from "../infrastructure/content-files/rule-sets/named-check-examples.ts";
import { createChecksRunner } from "../infrastructure/engines/eslint/runner/checks-runner/checks-runner.ts";
import { ESLINT_PROJECTED_KINDS } from "../infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts";
import {
  eslint9PieceModules,
  eslint9ToolchainModules,
} from "../infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts";
import { createEslintPort } from "../infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  type EslintToolchainModules,
  loadEslintToolchain,
} from "../infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { namedChecksRunnerModuleSchema } from "../infrastructure/engines/protocol/checks/checks-runner-module-schema.ts";
import { namedCheckConformance } from "../infrastructure/engines/protocol/conformance.ts";
import { loadedNamedRunnerOver } from "../infrastructure/engines/protocol/engine-run/engine-run.ts";
import { runnerModuleAt } from "../infrastructure/engines/protocol/runner-module/runner-module-at.ts";
import { toolchainBoundNamedChecksRunner } from "../infrastructure/engines/protocol/toolchain/toolchain-bound-runner.ts";
import { createDefaultFileRemovalPort } from "../infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import { loadFailureDetail } from "../infrastructure/printed-report/load-failures/load-failure-text.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../..`);

const DEVELOPMENT_PEERS = defaultEslintToolchainPeers({
  installRoot: INSTALL_ROOT,
  installForm: "source",
});

const ESLINT_CHECKS: readonly CheckAddressText[] = [
  "authored-class-or-this#class-keyword",
  "authored-class-or-this#static-members-only",
  "claimed-type#non-null-assertions",
  "long-function#function-length",
  "name-off-its-casing#filename-case",
  "name-off-its-casing#naming-convention",
  "positional-parameters#parameter-count",
  "rebinding#parameter-reassignment",
  "tangled-function#cognitive-complexity",
  "test-switched-off#focused-tests",
  "test-switched-off#skipped-tests",
  "thrown-non-error#throw-only-error",
  "untyped-value#explicit-any",
  "untyped-value#implicit-any-let",
  "wide-input#unread-parameter",
  "work-inside-a-condition#else-after-an-exit",
];

const ESLINT_MAJORS: readonly {
  readonly line: string;
  readonly eslintVersion: string;
  readonly modules: EslintToolchainModules;
  readonly pieceModules: (request: { readonly base: ModuleLoaderPort }) => ModuleLoaderPort;
}[] = [
  {
    line: "eslint-10",
    eslintVersion: "10.15.0",
    modules: DEVELOPMENT_PEERS.modules,
    pieceModules: (request) => request.base,
  },
  {
    line: "eslint-9",
    eslintVersion: "9.39.5",
    modules: eslint9ToolchainModules,
    pieceModules: eslint9PieceModules,
  },
];

describe("the ESLint majors Hone supports", () => {
  it.each(ESLINT_MAJORS)(
    "the $line toolchain loads ESLint $eslintVersion from the development install",
    async ({ modules, eslintVersion }) => {
      const loaded = await loadEslintToolchain({
        peers: { location: DEVELOPMENT_PEERS.location, modules },
      });

      assert(loaded.outcome === "ok");
      expect(loaded.value.eslintVersion).toBe(eslintVersion);
    },
  );
});

describe("the ESLint checks runner, loaded as core loads it, conforms to each ESLint check's shared cases on real ESLint", () => {
  it.each(ESLINT_CHECKS)(
    "%s has no conformance failure over its flag and allow cases",
    async (check) => {
      const path = createDefaultPathPort({});

      const conformance = await checkConformanceOf({
        ruleSet: TOOL_RULE_SET,
        check,
        engine: "eslint",
        installRoot: INSTALL_ROOT,
        moduleExtension: ".ts",
        path,
        modules: createDefaultModuleLoaderPort({}),
        examples: createNamedCheckExamplesRepository({
          fileText: createDefaultFileTextPort({}),
          path,
        }),
        loadFailureDetail,
        enginePort: {
          load: loadedNamedRunnerOver({ runnerModuleOf: runnerModuleAt }),
          conform: namedCheckConformance,
        },
      });

      expect(conformance).toEqual({ outcome: "ok", value: [] });
    },
  );
});

describe.each(ESLINT_MAJORS)(
  "the ESLint checks runner on $line, built as the shipped one is, conforms to each ESLint check's shared cases",
  ({ modules, pieceModules }) => {
    it.each(ESLINT_CHECKS)(
      "%s has no conformance failure over its flag and allow cases",
      async (check) => {
        const path = createDefaultPathPort({});
        const lineRunner = namedChecksRunnerModuleSchema.parse(
          toolchainBoundNamedChecksRunner({
            fileScope: "typescript",
            toolchain: loadEslintToolchain({
              peers: { location: DEVELOPMENT_PEERS.location, modules },
            }),
            projectedKinds: ESLINT_PROJECTED_KINDS,
            runnerOf: (toolchain) =>
              createChecksRunner({
                fileText: createDefaultFileTextPort({}),
                fileRemoval: createDefaultFileRemovalPort({}),
                modules: pieceModules({ base: createDefaultModuleLoaderPort({}) }),
                path,
                eslint: createEslintPort({ toolchain }),
                moduleExtension: ".ts",
              }),
          }),
        );

        const conformance = await checkConformanceOf({
          ruleSet: TOOL_RULE_SET,
          check,
          engine: "eslint",
          installRoot: INSTALL_ROOT,
          moduleExtension: ".ts",
          path,
          modules: createDefaultModuleLoaderPort({}),
          examples: createNamedCheckExamplesRepository({
            fileText: createDefaultFileTextPort({}),
            path,
          }),
          loadFailureDetail,
          enginePort: {
            load: vi
              .fn<NamedConformancePort["load"]>()
              .mockResolvedValue({ outcome: "ok", value: lineRunner }),
            conform: namedCheckConformance,
          },
        });

        expect(conformance).toEqual({ outcome: "ok", value: [] });
      },
    );
  },
);
