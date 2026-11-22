import { assert, describe, expect, it } from "vitest";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import { defaultClauseSettings } from "../../../../domain/settings/clause-settings/default-clause-settings.ts";
import type { Result } from "../../../../domain/result.ts";
import { checkConformance } from "../../protocol/conformance.ts";
import { runnerModuleSchema } from "../../protocol/runner-module/runner-module-schema.ts";
import type { RunnerClause } from "../../../../domain/runner/runner-module-types.ts";
import { editionRunsOf } from "../../../../domain/runner/edition-runs.ts";
import { toolchainBoundStandaloneRunner } from "../../protocol/toolchain/toolchain-bound-runner.ts";
import { readLocatedPieceFile } from "../../../content-files/rule-sets/located-piece-file.ts";
import { readInstalledNames } from "../../../content-files/rule-sets/installed-pieces.ts";
import { readHeldDiscipline } from "../../../content-files/rule-sets/held-discipline.ts";
import type { DisciplineFile, SourceCase } from "../../../../domain/rule-set/rule-set-types.ts";
import { clauseAddressSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { disciplineIdSchema } from "../../../hone-config-file/identifiers.ts";
import type { EngineId } from "../../../../domain/rule-set/identifier-types.ts";
import { createDefaultEntryKindPort } from "../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import type { FileTextPort } from "../../../../application/ports/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { createWalkerRunner } from "./create-walker-runner.ts";
import type { TypeScriptParsePort } from "./toolchain/typescript-parse.ts";
import { loadParsePort, typeScriptPeersNamed } from "./toolchain/typescript-toolchain.ts";
import * as walkerRunnerModule from "./runner.ts";

type ConformanceRow = {
  readonly name: string;
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
};

const RULE_SET_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../..`);

const disciplineOf = (request: { readonly fileText: FileTextPort; readonly discipline: string }): DisciplineFile => {
  const held = readHeldDiscipline({
    fileText: request.fileText,
    path: createDefaultPathPort({}),
    ruleSetRoot: RULE_SET_ROOT,
    installRoot: RULE_SET_ROOT,
    discipline: disciplineIdSchema.parse(request.discipline),
  });
  assert(held.outcome === "ok", `${request.discipline} reads through the install's discipline reader`);
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
  assert(piece.outcome === "ok", `${request.discipline} ${request.mechanism} piece.json reads through the rule-set reader`);
  return piece.value.clauses.flatMap((entry) => {
    const definition = discipline.clauses.find((clause) => clause.id === entry.clause);
    assert(definition?.kind === "mechanical", `${request.discipline}#${entry.clause} is a mechanical clause`);
    const clause: RunnerClause = {
      address: clauseAddressSchema.parse(`${request.discipline}#${entry.clause}`),
      anchor: definition.anchor,
      pieceRoot: entry.pieceRoot,
      settings: entry.settings,
      clauseSettings: defaultClauseSettings({ declarations: entry.clauseSettings }),
      edition: entry.editions.default,
    };
    return editionRunsOf({ clause, cases: [...definition.cases.flag, ...definition.cases.allow] }).map((run) => ({
      name: run.clause.edition === entry.editions.default
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

const heldNames = readInstalledNames({ fileText: createDefaultFileTextPort({}), path: createDefaultPathPort({}), installRoot: RULE_SET_ROOT });

assert(heldNames.outcome === "ok", "the install's version 1 names read");

const legacyDisciplines = [...new Set(heldNames.value.namedClauses.filter((clause) => clause.kind === "mechanical").map(({ clause }) => clause.discipline))].sort();

const CONFORMANCE_ROWS = conformanceRows({
  disciplines: legacyDisciplines,
  mechanism: "walker",
});

const walkerRunner = runnerModuleSchema.parse(walkerRunnerModule.runner);

describe("the shipped walker pieces", () => {
  it("includes example coverage through the installed version-one adapter", () => {
    expect(CONFORMANCE_ROWS).toEqual(expect.arrayContaining([expect.objectContaining({ name: "CD-14#class-syntax" })]));
  });
});

describe("the audit runner, loaded as core loads it, conforms to every registered clause's shared cases read from the shipped files (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)", () => {
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
