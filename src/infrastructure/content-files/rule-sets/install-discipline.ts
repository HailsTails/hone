import { z } from "zod";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { Held } from "../../../application/ports/rule-set/rule-set-files.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ClauseId, DisciplineId, MechanismId } from "../../../domain/rule-set/identifier-types.ts";
import type { ClauseDefinition, DisciplineFile } from "../../../domain/rule-set/rule-set-types.ts";
import { pieceFolderSegmentsOf } from "../../../domain/rule-set/piece-folder.ts";
import { everyOk } from "../../../domain/settings/every-ok.ts";
import { type NamedClause, readVersionOneNames, VERSION_ONE_NAMES_SEGMENTS } from "../../disciplines-file/version-one-names.ts";
import { ENGINE_REGISTRY } from "../../engines/engine-registry.ts";
import { clauseCasesSchema, pieceFilePath, pieceFileSchema, readVersionOneJson } from "./rule-set-reader.ts";

type InstallSource = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly installRoot: AbsolutePath;
  readonly discipline: DisciplineId;
};

type PieceHolding = { readonly mechanism: MechanismId; readonly folder: string; readonly clauses: readonly ClauseId[] };

type MechanicalClause = Extract<ClauseDefinition, { readonly kind: "mechanical" }>;

const CASES_FILE_SUFFIX = ".cases.json";

const MECHANISMS: readonly MechanismId[] = [...new Set(ENGINE_REGISTRY.map((engine) => engine.mechanism))];

const ruleSetInvalid = (request: { readonly path: string; readonly detail: string }): { readonly outcome: "failed"; readonly error: VersionTwoLoadFailure } => ({
  outcome: "failed",
  error: { kind: "rule-set-invalid", path: request.path, detail: request.detail },
});

const pieceOf = (request: InstallSource & { readonly mechanism: MechanismId }): Result<readonly PieceHolding[], VersionTwoLoadFailure> => {
  const location = { path: request.path, ruleSetRoot: request.installRoot, installRoot: request.installRoot, mechanism: request.mechanism, discipline: request.discipline };
  const path = pieceFilePath(location);
  if (request.fileText.exists({ path }) === "absent") {
    return { outcome: "ok", value: [] };
  }
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const piece = pieceFileSchema.safeParse(document.value);
  return piece.success
    ? {
        outcome: "ok",
        value: [{ mechanism: request.mechanism, folder: request.path.join({ segments: pieceFolderSegmentsOf(location) }), clauses: piece.data.clauses.map((entry) => entry.clause) }],
      }
    : { outcome: "failed", error: { kind: "file-malformed", path, detail: z.prettifyError(piece.error) } };
};

const piecesOf = (request: InstallSource): Result<readonly PieceHolding[], VersionTwoLoadFailure> => {
  const held = everyOk({ entries: MECHANISMS, resolve: (mechanism) => pieceOf({ ...request, mechanism }) });
  return held.outcome === "failed" ? held : { outcome: "ok", value: held.value.flat() };
};

const casesOf = (
  request: InstallSource & { readonly clause: ClauseId; readonly running: readonly PieceHolding[]; readonly namesPath: string },
): Result<MechanicalClause["cases"], VersionTwoLoadFailure> => {
  const address = `${request.discipline}#${request.clause}`;
  const held = request.running
    .map((piece) => request.path.join({ segments: [piece.folder, `${request.clause}${CASES_FILE_SUFFIX}`] }))
    .filter((path) => request.fileText.exists({ path }) === "present");
  const [path, ...others] = held;
  if (path === undefined) {
    return ruleSetInvalid({ path: request.namesPath, detail: `no piece that runs ${address} holds its ${request.clause}${CASES_FILE_SUFFIX}` });
  }
  if (others.length > 0) {
    return ruleSetInvalid({ path, detail: `the cases of ${address} sit beside more than one piece: ${held.join(", ")}` });
  }
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const cases = clauseCasesSchema.safeParse(document.value);
  return cases.success ? { outcome: "ok", value: cases.data } : ruleSetInvalid({ path, detail: z.prettifyError(cases.error) });
};

const definitionOf = (
  request: InstallSource & { readonly named: NamedClause; readonly pieces: readonly PieceHolding[]; readonly namesPath: string },
): Result<ClauseDefinition, VersionTwoLoadFailure> => {
  const { named } = request;
  if (named.kind === "judgement") {
    return { outcome: "ok", value: { kind: "judgement", id: named.clause.clause, enforcedBy: "review" } };
  }
  const running = request.pieces.filter((piece) => piece.clauses.includes(named.clause.clause));
  if (running.length === 0) {
    return ruleSetInvalid({ path: request.namesPath, detail: `no piece runs ${request.discipline}#${named.clause.clause}` });
  }
  const cases = casesOf({ ...request, clause: named.clause.clause, running });
  return cases.outcome === "failed"
    ? cases
    : {
        outcome: "ok",
        value: {
          kind: "mechanical",
          id: named.clause.clause,
          mechanisms: running.map((piece) => piece.mechanism),
          anchor: named.anchor,
          exceptions: "allowed",
          cases: cases.value,
        },
      };
};

export const readInstallDiscipline = (request: InstallSource): Result<Held<DisciplineFile>, VersionTwoLoadFailure> => {
  const namesPath = request.path.join({ segments: [request.installRoot, ...VERSION_ONE_NAMES_SEGMENTS] });
  const names = readVersionOneNames({ fileText: request.fileText, path: namesPath });
  if (names.outcome === "failed") {
    return names;
  }
  const named = names.value.namedClauses.filter((entry) => entry.clause.discipline === request.discipline);
  if (named.length === 0) {
    return { outcome: "ok", value: { held: "absent" } };
  }
  const pieces = piecesOf(request);
  if (pieces.outcome === "failed") {
    return pieces;
  }
  const clauses = everyOk({ entries: named, resolve: (entry) => definitionOf({ ...request, named: entry, pieces: pieces.value, namesPath }) });
  return clauses.outcome === "failed"
    ? clauses
    : { outcome: "ok", value: { held: "present", file: { version: 1, id: request.discipline, clauses: clauses.value } } };
};
