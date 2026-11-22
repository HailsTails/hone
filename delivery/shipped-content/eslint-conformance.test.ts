import { assert, describe, expect, it } from "vitest";

import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../src/application/ports/host/module-loader-port.ts";
import type { Result } from "../../src/domain/result.ts";
import type { EngineId } from "../../src/domain/rule-set/identifier-types.ts";
import type { DisciplineFile, SourceCase } from "../../src/domain/rule-set/rule-set-types.ts";
import { editionRunsOf } from "../../src/domain/runner/edition-runs.ts";
import type { RunnerFailure } from "../../src/domain/runner/runner-failure.ts";
import type { RunnerClause } from "../../src/domain/runner/runner-module-types.ts";
import { defaultClauseSettings } from "../../src/domain/settings/clause-settings/default-clause-settings.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { readHeldDiscipline } from "../../src/infrastructure/content-files/rule-sets/held-discipline.ts";
import { readInstalledNames } from "../../src/infrastructure/content-files/rule-sets/installed-pieces.ts";
import { readLocatedPieceFile } from "../../src/infrastructure/content-files/rule-sets/located-piece-file.ts";
import { clauseAddressSchema } from "../../src/infrastructure/discipline-exceptions-folder/clause-address.ts";
import {
  createEslintRunner,
  ESLINT_PROJECTED_KINDS,
} from "../../src/infrastructure/engines/eslint/runner/embedded-runner/create-eslint-runner.ts";
import * as eslintRunnerModule from "../../src/infrastructure/engines/eslint/runner/runner.ts";
import {
  eslint9PieceModules,
  eslint9ToolchainModules,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts";
import {
  createEslintPort,
  type EslintToolchain,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  type EslintToolchainModules,
  type EslintToolchainPeers,
  loadEslintToolchain,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { checkConformance } from "../../src/infrastructure/engines/protocol/conformance.ts";
import type { EmbeddedRunner } from "../../src/infrastructure/engines/protocol/embedded/embedded-runner-module-schema.ts";
import { runnerModuleSchema } from "../../src/infrastructure/engines/protocol/runner-module/runner-module-schema.ts";
import { toolchainBoundEmbeddedRunner } from "../../src/infrastructure/engines/protocol/toolchain/toolchain-bound-runner.ts";
import { disciplineIdSchema } from "../../src/infrastructure/hone-config-file/identifiers.ts";
import { createDefaultFileRemovalPort } from "../../src/infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";

type EslintLine = "eslint-10" | "eslint-9";

const ESLINT_LINES: readonly EslintLine[] = ["eslint-10", "eslint-9"];

type LineDefinition = {
  readonly eslintVersion: RegExp;
  readonly modules: EslintToolchainModules;
  readonly pieceModules: (request: { readonly base: ModuleLoaderPort }) => ModuleLoaderPort;
};

const DEVELOPMENT_PEERS: EslintToolchainPeers = defaultEslintToolchainPeers({
  installRoot: `${import.meta.dirname}/../..`,
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

const eslintRunnerOn = (request: { readonly line: EslintLine }): EmbeddedRunner =>
  toolchainBoundEmbeddedRunner({
    toolchain: loadedEslintToolchain(request).then(
      (toolchain): Result<EslintToolchain, RunnerFailure> => ({ outcome: "ok", value: toolchain }),
    ),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createEslintRunner({
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
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
};

const RULE_SET_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../..`);

const disciplineOf = (request: {
  readonly fileText: FileTextPort;
  readonly discipline: string;
}): DisciplineFile => {
  const held = readHeldDiscipline({
    fileText: request.fileText,
    path: createDefaultPathPort({}),
    ruleSetRoot: RULE_SET_ROOT,
    installRoot: RULE_SET_ROOT,
    discipline: disciplineIdSchema.parse(request.discipline),
  });
  assert(
    held.outcome === "ok",
    `${request.discipline} reads through the install's discipline reader`,
  );
  const discipline = held.value;
  assert(discipline.held === "present", `the install holds ${request.discipline}`);
  return discipline.file;
};

const rowsOf = (request: {
  readonly fileText: FileTextPort;
  readonly discipline: string;
  readonly mechanism: EngineId;
}): readonly ConformanceRow[] => {
  const discipline = disciplineOf(request);
  const piece = readLocatedPieceFile({
    fileText: request.fileText,
    path: createDefaultPathPort({}),
    ruleSetRoot: RULE_SET_ROOT,
    installRoot: RULE_SET_ROOT,
    mechanism: request.mechanism,
    discipline,
  });
  assert(
    piece.outcome === "ok",
    `${request.discipline} ${request.mechanism} piece.json reads through the rule-set reader`,
  );
  return piece.value.clauses.flatMap((entry) => {
    const definition = discipline.clauses.find((clause) => clause.id === entry.clause);
    assert(
      definition?.kind === "mechanical",
      `${request.discipline}#${entry.clause} is a mechanical clause`,
    );
    const clause: RunnerClause = {
      address: clauseAddressSchema.parse(`${request.discipline}#${entry.clause}`),
      anchor: definition.anchor,
      pieceRoot: entry.pieceRoot,
      settings: entry.settings,
      clauseSettings: defaultClauseSettings({ declarations: entry.clauseSettings }),
      edition: entry.editions.default,
    };
    return editionRunsOf({
      clause,
      cases: [...definition.cases.flag, ...definition.cases.allow],
    }).map((run) => ({
      name:
        run.clause.edition === entry.editions.default
          ? `${request.discipline}#${entry.clause}`
          : `${request.discipline}#${entry.clause} edition ${run.clause.edition}`,
      ...run,
    }));
  });
};

const conformanceRows = (request: {
  readonly disciplines: readonly string[];
  readonly mechanism: EngineId;
}): readonly ConformanceRow[] => {
  const fileText = createDefaultFileTextPort({});
  return request.disciplines.flatMap((discipline) =>
    rowsOf({ fileText, discipline, mechanism: request.mechanism }),
  );
};

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

const heldNames = readInstalledNames({
  fileText: createDefaultFileTextPort({}),
  path: createDefaultPathPort({}),
  installRoot: RULE_SET_ROOT,
});

assert(heldNames.outcome === "ok", "the install's version 1 names read");

const legacyDisciplines = [
  ...new Set(
    heldNames.value.namedClauses
      .filter((clause) => clause.kind === "mechanical")
      .map(({ clause }) => clause.discipline),
  ),
].sort();

const eslintDisciplines = legacyDisciplines;

const CONFORMANCE_ROWS = conformanceRows({
  disciplines: eslintDisciplines,
  mechanism: "eslint",
});

const eslintRunner = runnerModuleSchema.parse(eslintRunnerModule.runner);

describe("the ESLint runner, loaded as core loads it, conforms to every registered ESLint clause's shared cases on real ESLint (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)", () => {
  it.each(CONFORMANCE_ROWS)(
    "$name has no conformance failure over its flag and allow cases",
    async (row) => {
      expect(
        await checkConformance({ clause: row.clause, cases: row.cases, runner: eslintRunner }),
      ).toEqual({
        outcome: "ok",
        value: [],
      });
    },
  );
});

describe.each(ESLINT_LINES)(
  "the ESLint runner on %s, its floor lines with the oldest supported typescript-eslint, conforms to every registered ESLint clause's shared cases (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)",
  (line) => {
    const lineRunner = runnerModuleSchema.parse(eslintRunnerOn({ line }));

    it.each(CONFORMANCE_ROWS)(
      "$name has no conformance failure over its flag and allow cases",
      async (row) => {
        expect(
          await checkConformance({ clause: row.clause, cases: row.cases, runner: lineRunner }),
        ).toEqual({
          outcome: "ok",
          value: [],
        });
      },
    );
  },
);
