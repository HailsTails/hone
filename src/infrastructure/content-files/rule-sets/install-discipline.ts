import { z } from "zod";

import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { Held } from "../../../application/ports/rule-set/rule-set-files.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { DisciplineId, EngineId } from "../../../domain/rule-set/identifier-types.ts";
import type { ClauseDefinition, DisciplineFile } from "../../../domain/rule-set/rule-set-types.ts";
import { everyOk } from "../../../domain/settings/every-ok.ts";
import type { NamedClause, VersionOneNames } from "../../disciplines-file/version-one-names.ts";
import { ENGINE_REGISTRY } from "../../engines/engine-registry.ts";
import {
  installedNamesPathOf,
  installedPiecesFor,
  readInstalledNames,
} from "./installed-pieces.ts";
import { clauseCasesSchema, readVersionOneJson } from "./rule-set-reader.ts";

type InstallSource = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly installRoot: AbsolutePath;
  readonly discipline: DisciplineId;
};

type MechanicalClause = Extract<ClauseDefinition, { readonly kind: "mechanical" }>;

const MECHANISMS: readonly EngineId[] = ENGINE_REGISTRY.map((engine) => engine.name);

const ruleSetInvalid = (request: {
  readonly path: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: VersionTwoLoadFailure } => ({
  outcome: "failed",
  error: { kind: "rule-set-invalid", path: request.path, detail: request.detail },
});

const casesOf = (
  request: InstallSource & {
    readonly address: string;
    readonly examplesPaths: readonly string[];
    readonly namesPath: string;
  },
): Result<MechanicalClause["cases"], VersionTwoLoadFailure> => {
  const path = request.examplesPaths.find(
    (path) => request.fileText.exists({ path }) === "present",
  );
  if (path === undefined) {
    return ruleSetInvalid({
      path: request.namesPath,
      detail: `no piece that runs ${request.address} holds its examples`,
    });
  }
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const cases = clauseCasesSchema.safeParse(document.value);
  return cases.success
    ? { outcome: "ok", value: cases.data }
    : ruleSetInvalid({ path, detail: z.prettifyError(cases.error) });
};

const definitionOf = (
  request: InstallSource & {
    readonly named: NamedClause;
    readonly names: VersionOneNames;
    readonly namesPath: string;
  },
): Result<ClauseDefinition, VersionTwoLoadFailure> => {
  const { named } = request;
  if (named.kind === "judgement") {
    return {
      outcome: "ok",
      value: { kind: "judgement", id: named.clause.clause, enforcedBy: "review" },
    };
  }
  const running = installedPiecesFor({ ...request, clause: named.clause, mechanisms: MECHANISMS });
  if (running.outcome === "failed") {
    return running;
  }
  const address = `${request.discipline}#${named.clause.clause}`;
  if (running.value.length === 0) {
    return ruleSetInvalid({ path: request.namesPath, detail: `no piece runs ${address}` });
  }
  const cases = casesOf({
    ...request,
    address,
    examplesPaths: running.value.map((piece) => piece.examplesPath),
  });
  return cases.outcome === "failed"
    ? cases
    : {
        outcome: "ok",
        value: {
          kind: "mechanical",
          id: named.clause.clause,
          mechanisms: running.value.map((piece) => piece.mechanism),
          anchor: named.anchor,
          exceptions: "allowed",
          cases: cases.value,
        },
      };
};

export const readInstallDiscipline = (
  request: InstallSource,
): Result<Held<DisciplineFile>, VersionTwoLoadFailure> => {
  const namesPath = installedNamesPathOf(request);
  const names = readInstalledNames(request);
  if (names.outcome === "failed") {
    return names;
  }
  const named = names.value.namedClauses.filter(
    (entry) => entry.clause.discipline === request.discipline,
  );
  if (named.length === 0) {
    return { outcome: "ok", value: { held: "absent" } };
  }
  const clauses = everyOk({
    entries: named,
    resolve: (entry) => definitionOf({ ...request, named: entry, names: names.value, namesPath }),
  });
  return clauses.outcome === "failed"
    ? clauses
    : {
        outcome: "ok",
        value: {
          held: "present",
          file: { version: 1, id: request.discipline, clauses: clauses.value },
        },
      };
};
