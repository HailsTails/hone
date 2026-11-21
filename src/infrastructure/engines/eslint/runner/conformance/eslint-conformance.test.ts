import { assert, describe, expect, it, vi } from "vitest";
import { editionRunsOf } from "../../../../../application/conformance/edition-runs.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { defaultClauseSettings } from "../../../../../domain/settings/clause-settings/default-clause-settings.ts";
import type { Result } from "../../../../../domain/result.ts";
import { checkConformance } from "../../../protocol/conformance.ts";
import type { EmbeddedRunner } from "../../../protocol/embedded/embedded-runner-module-schema.ts";
import { runnerModuleSchema } from "../../../protocol/runner-module/runner-module-schema.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import { toolchainBoundEmbeddedRunner } from "../../../protocol/toolchain/toolchain-bound-runner.ts";
import { createDefaultFileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import { createDefaultPathPort, createPathPort } from "../../../../node/path-port.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { readDisciplineFile, readPieceFile } from "../../../../content-files/rule-sets/rule-set-reader.ts";
import type { DisciplineFile, SourceCase } from "../../../../../domain/rule-set/rule-set-types.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { disciplineIdSchema, mechanismIdSchema } from "../../../../hone-config-file/identifiers.ts";
import type { MechanismId } from "../../../../../domain/rule-set/identifier-types.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "../embedded-runner/create-eslint-runner.ts";
import { eslint9PieceModules, eslint9ToolchainModules } from "../toolchain/eslint-9/eslint-9-engine.ts";
import { createEslintPort, type EslintToolchain } from "../toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  type EslintToolchainModules,
  type EslintToolchainPeers,
  loadEslintToolchain,
} from "../toolchain/eslint-toolchain.ts";
import * as eslintRunnerModule from "../runner.ts";

type EslintLine = "eslint-10" | "eslint-9";

const ESLINT_LINES: readonly EslintLine[] = ["eslint-10", "eslint-9"];

type LineDefinition = {
  readonly eslintVersion: RegExp;
  readonly modules: EslintToolchainModules;
  readonly pieceModules: (request: { readonly base: ModuleLoaderPort }) => ModuleLoaderPort;
};

const DEVELOPMENT_PEERS: EslintToolchainPeers = defaultEslintToolchainPeers({ installRoot: `${import.meta.dirname}/../../../../../..`, installForm: "source" });

const LINES: Readonly<Record<EslintLine, LineDefinition>> = {
  "eslint-10": { eslintVersion: /^10\./, modules: DEVELOPMENT_PEERS.modules, pieceModules: (request) => request.base },
  "eslint-9": { eslintVersion: /^9\./, modules: eslint9ToolchainModules, pieceModules: eslint9PieceModules },
};

const loadedEslintToolchain = async (request: { readonly line: EslintLine }): Promise<EslintToolchain> => {
  const loaded = await loadEslintToolchain({ peers: { location: DEVELOPMENT_PEERS.location, modules: LINES[request.line].modules } });
  assert(loaded.outcome === "ok", `the ${request.line} toolchain loads from the development install`);
  assert(
    LINES[request.line].eslintVersion.test(loaded.value.eslintVersion),
    `the ${request.line} toolchain runs ESLint ${loaded.value.eslintVersion}`,
  );
  return loaded.value;
};

const pieceModulesOn = (request: { readonly line: EslintLine; readonly base: ModuleLoaderPort }): ModuleLoaderPort =>
  LINES[request.line].pieceModules({ base: request.base });

const eslintRunnerOn = (request: { readonly line: EslintLine }): EmbeddedRunner =>
  toolchainBoundEmbeddedRunner({
    toolchain: loadedEslintToolchain(request).then((toolchain): Result<EslintToolchain, RunnerFailure> => ({ outcome: "ok", value: toolchain })),
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

type RawTable = Readonly<Record<string, string>>;

type ConformanceRow = {
  readonly name: string;
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
};

const RULE_SET_ROOT = absolutePathSchema.parse("/install");

const folderOf = (request: { readonly key: string }): string => request.key.split("/").at(-2) ?? "";

const foldersUnder = (request: { readonly table: RawTable; readonly prefix: string }): readonly string[] =>
  [
    ...new Set(
      Object.keys(request.table)
        .filter((key) => key.startsWith(request.prefix))
        .map((key) => folderOf({ key })),
    ),
  ].sort();

const requiredEntry = (request: { readonly table: RawTable; readonly key: string }): string => {
  const entry = request.table[request.key];
  assert(entry !== undefined, `the fake table holds no entry for ${request.key}`);
  return entry;
};

const tableFileText = (request: { readonly table: RawTable }): FileTextPort => ({
  read: ({ path }) => ({
    outcome: "ok",
    value: requiredEntry({ table: request.table, key: path.replace("/install/", "./") }),
  }),
  exists: () => "present",
  write: vi.fn<FileTextPort["write"]>(),
});

const disciplineOf = (request: { readonly fileText: FileTextPort; readonly discipline: string }): DisciplineFile => {
  const discipline = readDisciplineFile({
    fileText: request.fileText,
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/install" }),
    ruleSetRoot: RULE_SET_ROOT,
    discipline: disciplineIdSchema.parse(request.discipline),
  });
  assert(discipline.outcome === "ok", `${request.discipline} discipline.json reads through the rule-set reader`);
  return discipline.value;
};

const rowsOf = (request: {
  readonly fileText: FileTextPort;
  readonly discipline: string;
  readonly mechanism: MechanismId;
  readonly mechanismRoot: string;
}): readonly ConformanceRow[] => {
  const discipline = disciplineOf(request);
  const piece = readPieceFile({
    fileText: request.fileText,
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/install" }),
    ruleSetRoot: RULE_SET_ROOT,
    installRoot: RULE_SET_ROOT,
    mechanism: request.mechanism,
    discipline,
  });
  assert(piece.outcome === "ok", `${request.discipline} ${request.mechanism} piece.json reads through the rule-set reader`);
  return piece.value.clauses.flatMap((entry) => {
    const definition = discipline.clauses.find((clause) => clause.id === entry.clause);
    assert(definition?.kind === "mechanical", `${request.discipline}#${entry.clause} is a mechanical clause`);
    const runs = editionRunsOf({
      clause: {
        address: clauseAddressSchema.parse(`${request.discipline}#${entry.clause}`),
        anchor: definition.anchor,
        pieceRoot: `${request.mechanismRoot}/${request.discipline}`,
        settings: entry.settings,
        clauseSettings: defaultClauseSettings({ declarations: entry.clauseSettings }),
        edition: entry.editions.default,
      },
      cases: [...definition.cases.flag, ...definition.cases.allow],
    });
    return runs.map((run) => ({
      name: run.clause.edition === entry.editions.default
        ? `${request.discipline}#${entry.clause}`
        : `${request.discipline}#${entry.clause} edition ${run.clause.edition}`,
      ...run,
    }));
  });
};

const conformanceRows = (request: {
  readonly table: RawTable;
  readonly disciplines: readonly string[];
  readonly mechanism: MechanismId;
  readonly mechanismRoot: string;
}): readonly ConformanceRow[] => {
  const fileText = tableFileText({ table: request.table });
  return request.disciplines.flatMap((discipline) =>
    rowsOf({ fileText, discipline, mechanism: request.mechanism, mechanismRoot: request.mechanismRoot }),
  );
};

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const ruleSetTexts = import.meta.glob(["./rules/*/discipline.json", "./src/infrastructure/engines/eslint/*/piece.json"], {
  base: "../../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const eslintDisciplines = foldersUnder({ table: ruleSetTexts, prefix: "./src/infrastructure/engines/eslint/" });

const CONFORMANCE_ROWS = conformanceRows({
  table: ruleSetTexts,
  disciplines: eslintDisciplines,
  mechanism: mechanismIdSchema.parse("eslint"),
  mechanismRoot: `${import.meta.dirname}/../..`,
});

const eslintRunner = runnerModuleSchema.parse(eslintRunnerModule.runner);

describe("every ESLint piece on disk is registered against a discipline.json", () => {
  it("has a discipline.json for each ESLint piece folder", () => {
    expect(foldersUnder({ table: ruleSetTexts, prefix: "./rules/" })).toEqual(
      expect.arrayContaining([...eslintDisciplines]),
    );
  });
});

describe("the ESLint runner, loaded as core loads it, conforms to every registered ESLint clause's shared cases on real ESLint (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)", () => {
  it.each(CONFORMANCE_ROWS)("$name has no conformance failure over its flag and allow cases", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: row.cases, runner: eslintRunner })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});

describe.each(ESLINT_LINES)("the ESLint runner on %s, its floor lines with the oldest supported typescript-eslint, conforms to every registered ESLint clause's shared cases (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)", (line) => {
  const lineRunner = runnerModuleSchema.parse(eslintRunnerOn({ line }));

  it.each(CONFORMANCE_ROWS)("$name has no conformance failure over its flag and allow cases", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: row.cases, runner: lineRunner })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});
