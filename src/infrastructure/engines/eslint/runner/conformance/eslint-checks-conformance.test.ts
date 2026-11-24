import { assert, describe, expect, it, vi } from "vitest";

import { catalogueConformanceOf } from "../../../../../application/conformance/catalogue-conformance.ts";
import type { NamedConformancePort } from "../../../../../application/ports/engine/engine-port.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { createNamedCheckExamplesRepository } from "../../../../content-files/rule-sets/named-check-examples.ts";
import { readBoundCatalogue } from "../../../../content-files/symptom-catalogues/bound-catalogue.ts";
import { createDefaultFileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { loadFailureDetail } from "../../../../printed-report/load-failures/load-failure-text.ts";
import { namedChecksRunnerModuleSchema } from "../../../protocol/checks/checks-runner-module-schema.ts";
import { namedCheckConformance } from "../../../protocol/conformance.ts";
import { loadedNamedRunnerOver } from "../../../protocol/engine-run/engine-run.ts";
import { runnerModuleAt } from "../../../protocol/runner-module/runner-module-at.ts";
import { toolchainBoundNamedChecksRunner } from "../../../protocol/toolchain/toolchain-bound-runner.ts";
import { createChecksRunner } from "../checks-runner/checks-runner.ts";
import { ESLINT_PROJECTED_KINDS } from "../embedded-runner/create-eslint-runner.ts";
import {
  eslint9PieceModules,
  eslint9ToolchainModules,
} from "../toolchain/eslint-9/eslint-9-engine.ts";
import { createEslintPort } from "../toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "../toolchain/eslint-toolchain.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: {
        readonly base: string;
        readonly query: "?raw";
        readonly import: "default";
        readonly eager: true;
      },
    ) => Readonly<Record<string, string>>;
  }
}

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);

const DEVELOPMENT_PEERS = defaultEslintToolchainPeers({
  installRoot: INSTALL_ROOT,
  installForm: "source",
});

const ESLINT_LINES = [
  {
    line: "eslint-10",
    eslintVersion: /^10\./,
    modules: DEVELOPMENT_PEERS.modules,
    pieceModules: (request: { readonly base: ModuleLoaderPort }): ModuleLoaderPort => request.base,
  },
  {
    line: "eslint-9",
    eslintVersion: /^9\./,
    modules: eslint9ToolchainModules,
    pieceModules: eslint9PieceModules,
  },
] as const;

describe("the ESLint toolchain lines Hone supports", () => {
  it.each(ESLINT_LINES)(
    "the $line toolchain loads its ESLint major from the development install",
    async ({ modules, eslintVersion }) => {
      const loaded = await loadEslintToolchain({
        peers: { location: DEVELOPMENT_PEERS.location, modules },
      });

      assert(loaded.outcome === "ok");
      expect(loaded.value.eslintVersion).toMatch(eslintVersion);
    },
  );
});

describe("the shipped catalogue", () => {
  it("binds checks to the ESLint engine", () => {
    const catalogue = readBoundCatalogue({
      ruleSet: TOOL_RULE_SET,
      inheritedRecordKinds: [],
      fileText: createDefaultFileTextPort({}),
      path: createDefaultPathPort({}),
      directory: createDefaultDirectoryPort({}),
      ruleSetRoot: INSTALL_ROOT,
      installRoot: INSTALL_ROOT,
    });

    assert(catalogue.outcome === "ok");
    assert(catalogue.value.held === "catalogue");
    expect(catalogue.value.catalogue.checks).toContainEqual(
      expect.objectContaining({ name: "function-length", engines: [{ name: "eslint" }] }),
    );
  });
});

describe("the ESLint checks runner, loaded as core loads it, conforms to every ESLint check the shipped catalogue binds, on real ESLint", () => {
  it("has no conformance failure over any check's flag and allow cases", async () => {
    const path = createDefaultPathPort({});
    const fileText = createDefaultFileTextPort({});
    const catalogue = readBoundCatalogue({
      ruleSet: TOOL_RULE_SET,
      inheritedRecordKinds: [],
      fileText,
      path,
      directory: createDefaultDirectoryPort({}),
      ruleSetRoot: INSTALL_ROOT,
      installRoot: INSTALL_ROOT,
    });
    assert(catalogue.outcome === "ok");
    assert(catalogue.value.held === "catalogue");

    const conformance = await catalogueConformanceOf({
      checks: catalogue.value.catalogue.checks,
      ruleSet: TOOL_RULE_SET,
      engine: "eslint",
      installRoot: INSTALL_ROOT,
      moduleExtension: ".ts",
      path,
      modules: createDefaultModuleLoaderPort({}),
      examples: createNamedCheckExamplesRepository({ fileText, path }),
      loadFailureDetail,
      enginePort: {
        load: loadedNamedRunnerOver({ runnerModuleOf: runnerModuleAt }),
        conform: namedCheckConformance,
      },
    });

    expect(conformance).toEqual({ outcome: "ok", value: [] });
  });
});

describe("the ESLint checks runner, built as the shipped one is, conforms to every ESLint check the shipped catalogue binds", () => {
  it.each(ESLINT_LINES)(
    "has no conformance failure on $line",
    async ({ modules, pieceModules }) => {
      const path = createDefaultPathPort({});
      const fileText = createDefaultFileTextPort({});
      const catalogue = readBoundCatalogue({
        ruleSet: TOOL_RULE_SET,
        inheritedRecordKinds: [],
        fileText,
        path,
        directory: createDefaultDirectoryPort({}),
        ruleSetRoot: INSTALL_ROOT,
        installRoot: INSTALL_ROOT,
      });
      assert(catalogue.outcome === "ok");
      assert(catalogue.value.held === "catalogue");
      const lineRunner = namedChecksRunnerModuleSchema.parse(
        toolchainBoundNamedChecksRunner({
          fileScope: "typescript",
          toolchain: loadEslintToolchain({
            peers: { location: DEVELOPMENT_PEERS.location, modules },
          }),
          projectedKinds: ESLINT_PROJECTED_KINDS,
          runnerOf: (toolchain) =>
            createChecksRunner({
              fileText,
              fileRemoval: createDefaultFileRemovalPort({}),
              modules: pieceModules({ base: createDefaultModuleLoaderPort({}) }),
              path,
              eslint: createEslintPort({ toolchain }),
              moduleExtension: ".ts",
            }),
        }),
      );

      const conformance = await catalogueConformanceOf({
        checks: catalogue.value.catalogue.checks,
        ruleSet: TOOL_RULE_SET,
        engine: "eslint",
        installRoot: INSTALL_ROOT,
        moduleExtension: ".ts",
        path,
        modules: createDefaultModuleLoaderPort({}),
        examples: createNamedCheckExamplesRepository({ fileText, path }),
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
});
