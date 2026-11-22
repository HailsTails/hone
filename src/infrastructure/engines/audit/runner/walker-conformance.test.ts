import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import { defaultClauseSettings } from "../../../../domain/settings/clause-settings/default-clause-settings.ts";
import type { Result } from "../../../../domain/result.ts";
import { checkConformance } from "../../protocol/conformance.ts";
import { runnerModuleSchema } from "../../protocol/runner-module/runner-module-schema.ts";
import type { RunnerClause } from "../../../../domain/runner/runner-module-types.ts";
import { toolchainBoundStandaloneRunner } from "../../protocol/toolchain/toolchain-bound-runner.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { readDisciplineFile, readPieceFile } from "../../../content-files/rule-sets/rule-set-reader.ts";
import type { DisciplineFile, SourceCase } from "../../../../domain/rule-set/rule-set-types.ts";
import { clauseAddressSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { disciplineIdSchema, mechanismIdSchema } from "../../../hone-config-file/identifiers.ts";
import type { MechanismId } from "../../../../domain/rule-set/identifier-types.ts";
import { createDefaultEntryKindPort } from "../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import type { FileTextPort } from "../../../../application/ports/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort, createPathPort } from "../../../node/path-port.ts";
import { createWalkerRunner } from "./create-walker-runner.ts";
import type { TypeScriptParsePort } from "./toolchain/typescript-parse.ts";
import { loadParsePort, typeScriptPeersNamed } from "./toolchain/typescript-toolchain.ts";
import * as walkerRunnerModule from "./runner.ts";

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

const tableFileText = (request: { readonly table: RawTable }): FileTextPort => ({
  read: ({ path }) => {
    const key = path.replace("/install/", "./");
    const text = request.table[key];
    assert(text !== undefined, `the fake table holds no entry for ${key}`);
    return { outcome: "ok", value: text };
  },
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
    const casesByEdition = Map.groupBy(
      [...definition.cases.flag, ...definition.cases.allow],
      (sourceCase) => sourceCase.edition ?? entry.editions.default,
    );
    return [...casesByEdition].map(([edition, cases]) => ({
      name: edition === entry.editions.default
        ? `${request.discipline}#${entry.clause}`
        : `${request.discipline}#${entry.clause} edition ${edition}`,
      clause: {
        address: clauseAddressSchema.parse(`${request.discipline}#${entry.clause}`),
        anchor: definition.anchor,
        pieceRoot: `${request.mechanismRoot}/${request.discipline}`,
        settings: entry.settings,
        clauseSettings: defaultClauseSettings({ declarations: entry.clauseSettings }),
        edition,
      },
      cases,
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

const FLOOR_PEERS = typeScriptPeersNamed({ installRoot: `${import.meta.dirname}/../../../../..`, installForm: "source", packageName: "typescript-floor" });

const floorParsePort = async (): Promise<TypeScriptParsePort> => {
  const loaded = await loadParsePort({ peers: FLOOR_PEERS });
  assert(loaded.outcome === "ok", "the typescript-floor line loads from the development install");
  assert(/^4\.8\.4$/.test(loaded.value.syntaxApi.version), `the typescript-floor line runs TypeScript ${loaded.value.syntaxApi.version}`);
  return loaded.value;
};

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const ruleSetTexts = import.meta.glob(["./rules/*/discipline.json", "./src/infrastructure/engines/audit/*/piece.json"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const walkerModules = import.meta.glob(["./src/infrastructure/engines/audit/*/*.ts", "!./src/infrastructure/engines/audit/*/*.test.ts", "!./src/infrastructure/engines/audit/runner/*"], {
  base: "../../../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const walkerDisciplines = foldersUnder({ table: walkerModules, prefix: "./src/infrastructure/engines/audit/" });

const CONFORMANCE_ROWS = conformanceRows({
  table: ruleSetTexts,
  disciplines: walkerDisciplines,
  mechanism: mechanismIdSchema.parse("audit"),
  mechanismRoot: `${import.meta.dirname}/..`,
});

const walkerRunner = runnerModuleSchema.parse(walkerRunnerModule.runner);

describe("every audit piece on disk is registered with a piece.json and a discipline.json", () => {
  it("has a piece.json for each audit piece folder", () => {
    expect(foldersUnder({ table: ruleSetTexts, prefix: "./src/infrastructure/engines/audit/" })).toEqual(walkerDisciplines);
  });

  it("has a discipline.json for each audit piece folder", () => {
    expect(foldersUnder({ table: ruleSetTexts, prefix: "./rules/" })).toEqual(expect.arrayContaining([...walkerDisciplines]));
  });
});

describe("the audit runner, loaded as core loads it, conforms to every registered clause's shared cases read as build-time raw modules (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)", () => {
  it.each(CONFORMANCE_ROWS)("$name has no conformance failure over its flag and allow cases", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: row.cases, runner: walkerRunner })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});

describe("the audit runner on the oldest supported TypeScript, 4.8.4, conforms to every registered clause's shared cases (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)", () => {
  const floorRunner = runnerModuleSchema.parse(
    toolchainBoundStandaloneRunner({
      toolchain: floorParsePort().then((parse): Result<TypeScriptParsePort, RunnerFailure> => ({ outcome: "ok", value: parse })),
      runnerOf: (parse) =>
        createWalkerRunner({
          fileText: createDefaultFileTextPort({}),
          modules: createDefaultModuleLoaderPort({}),
          path: createDefaultPathPort({}),
          parse,
          entryKind: createDefaultEntryKindPort({}),
        }),
    }),
  );

  it.each(CONFORMANCE_ROWS)("$name has no conformance failure over its flag and allow cases", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: row.cases, runner: floorRunner })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});
