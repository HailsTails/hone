import { assert, vi } from "vitest";
import { defaultClauseSettings } from "../src/domain/settings/clause-settings/default-clause-settings.ts";
import type { RunnerClause } from "../src/infrastructure/engines/protocol/runner-module/runner-module-schema.ts";
import type { FileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import { createPathPort } from "../src/infrastructure/node/path-port.ts";
import {
  type DisciplineFile,
  readDisciplineFile,
  readPieceFile,
  type SourceCase,
} from "../src/infrastructure/content-files/rule-sets/rule-set-reader.ts";
import { absolutePathSchema } from "../src/infrastructure/content-files/absolute-path.ts";
import { clauseAddressSchema } from "../src/infrastructure/discipline-exceptions-folder/clause-address.ts";
import { disciplineIdSchema, type MechanismId } from "../src/infrastructure/hone-config-file/identifiers.ts";
import { requiredEntry } from "./required-entry.ts";
import { editionRunsOf } from "../src/application/conformance/edition-runs.ts";

export type RawTable = Readonly<Record<string, string>>;

export type ConformanceRow = {
  readonly name: string;
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
};

const RULE_SET_ROOT = absolutePathSchema.parse("/install");

const folderOf = (request: { readonly key: string }): string => request.key.split("/").at(-2) ?? "";

export const foldersUnder = (request: { readonly table: RawTable; readonly prefix: string }): readonly string[] =>
  [
    ...new Set(
      Object.keys(request.table)
        .filter((key) => key.startsWith(request.prefix))
        .map((key) => folderOf({ key })),
    ),
  ].sort();

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

export const conformanceRows = (request: {
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
