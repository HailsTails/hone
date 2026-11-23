import { assert, describe, expect, it } from "vitest";

import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import { checkAddressTextOf } from "../../../../../domain/language-layer/check-address-text.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { SourceCase } from "../../../../../domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { casesByEdition } from "../../../../../domain/runner/edition-runs.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { defaultClauseSettings } from "../../../../../domain/settings/clause-settings/default-clause-settings.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { createNamedCheckExamplesRepository } from "../../../../content-files/rule-sets/named-check-examples.ts";
import { readBoundCatalogue } from "../../../../content-files/symptom-catalogues/bound-catalogue.ts";
import { createDefaultFileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { namedChecksRunnerModuleSchema } from "../../../protocol/checks/checks-runner-module-schema.ts";
import type { NamedChecksRunner } from "../../../protocol/checks/checks-runner-types.ts";
import { namedCheckConformance } from "../../../protocol/conformance.ts";
import { loadedNamedRunnerOf } from "../../../protocol/engine-run/engine-run.ts";
import { toolchainBoundNamedChecksRunner } from "../../../protocol/toolchain/toolchain-bound-runner.ts";
import { createChecksRunner } from "../checks-runner/checks-runner.ts";
import { ESLINT_PROJECTED_KINDS } from "../embedded-runner/create-eslint-runner.ts";
import {
  eslint9PieceModules,
  eslint9ToolchainModules,
} from "../toolchain/eslint-9/eslint-9-engine.ts";
import { createEslintPort, type EslintToolchain } from "../toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  type EslintToolchainModules,
  type EslintToolchainPeers,
  loadEslintToolchain,
} from "../toolchain/eslint-toolchain.ts";

type EslintLine = "eslint-10" | "eslint-9";

const ESLINT_LINES: readonly EslintLine[] = ["eslint-10", "eslint-9"];

type LineDefinition = {
  readonly eslintVersion: RegExp;
  readonly modules: EslintToolchainModules;
  readonly pieceModules: (request: { readonly base: ModuleLoaderPort }) => ModuleLoaderPort;
};

const DEVELOPMENT_PEERS: EslintToolchainPeers = defaultEslintToolchainPeers({
  installRoot: `${import.meta.dirname}/../../../../../..`,
  installForm: "source",
});

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

const eslintChecksRunnerOn = (request: { readonly line: EslintLine }): NamedChecksRunner =>
  toolchainBoundNamedChecksRunner({
    fileScope: "typescript",
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

type ConformanceRow = {
  readonly name: string;
  readonly binding: CheckBinding;
  readonly cases: readonly SourceCase[];
};

const RULE_SET_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);

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

const fileText = createDefaultFileTextPort({});
const path = createDefaultPathPort({});
const catalogue = readBoundCatalogue({
  ruleSet: "hone",
  fileText,
  path,
  directory: createDefaultDirectoryPort({}),
  ruleSetRoot: RULE_SET_ROOT,
  installRoot: RULE_SET_ROOT,
});
assert(catalogue.outcome === "ok" && catalogue.value.held === "catalogue");
const examples = createNamedCheckExamplesRepository({ fileText, path });
const CONFORMANCE_ROWS: readonly ConformanceRow[] = catalogue.value.catalogue.checks
  .filter(({ engines }) => engines.some(({ name }) => name === "eslint"))
  .flatMap((check) => {
    const address = checkAddressTextOf({ check });
    const held = examples.read({
      check: address,
      engine: "eslint",
      installRoot: RULE_SET_ROOT,
      ruleSetRoot: RULE_SET_ROOT,
    });
    assert(held.outcome === "ok");
    const { piece } = held.value;
    return casesByEdition({
      defaultEdition: piece.editions.default,
      cases: held.value.examples,
    }).map(({ edition, cases }) => ({
      name: `${address} edition ${edition}`,
      binding: {
        address,
        ruleSet: "hone",
        engine: "eslint",
        edition,
        anchor: piece.anchor,
        pieceRoot: piece.pieceRoot,
        settings: piece.settings,
        checkSettings: defaultClauseSettings({ declarations: piece.declarations }),
        forms: piece.forms,
      },
      cases,
    }));
  });

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);

const shippedEngine = await loadedNamedRunnerOf({
  mechanism: "eslint",
  installRoot: INSTALL_ROOT,
  moduleExtension: ".ts",
  path: createDefaultPathPort({}),
  modules: createDefaultModuleLoaderPort({}),
});

assert(shippedEngine.outcome === "ok", "core loads the ESLint module");

const shippedChecksRunner = shippedEngine.value;

describe("the ESLint checks runner, loaded as core loads it, conforms to every registered ESLint clause's shared cases on real ESLint (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)", () => {
  it.each(CONFORMANCE_ROWS)(
    "$name has no conformance failure over its flag and allow cases",
    async (row) => {
      expect(
        await namedCheckConformance({
          binding: row.binding,
          cases: row.cases,
          runner: shippedChecksRunner,
        }),
      ).toEqual({
        outcome: "ok",
        value: [],
      });
    },
  );
});

describe.each(ESLINT_LINES)(
  "the ESLint checks runner on %s, built as the shipped one is, conforms to every registered ESLint clause's shared cases (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)",
  (line) => {
    const lineRunner = namedChecksRunnerModuleSchema.parse(eslintChecksRunnerOn({ line }));

    it.each(CONFORMANCE_ROWS)(
      "$name has no conformance failure over its flag and allow cases",
      async (row) => {
        expect(
          await namedCheckConformance({
            binding: row.binding,
            cases: row.cases,
            runner: lineRunner,
          }),
        ).toEqual({
          outcome: "ok",
          value: [],
        });
      },
    );
  },
);
