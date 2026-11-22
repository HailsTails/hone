import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { LocatedPieceFile } from "../../../application/ports/rule-set/rule-set-files.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import { pieceFolderSegmentsOf } from "../../../domain/rule-set/piece-folder.ts";
import type { DisciplineFile } from "../../../domain/rule-set/rule-set-types.ts";
import { everyOk } from "../../../domain/settings/every-ok.ts";
import { firstInstalledPieceFor, readInstalledNames } from "./installed-pieces.ts";
import { readPieceFile } from "./rule-set-reader.ts";

type PieceRequest = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly ruleSetRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly mechanism: EngineId;
  readonly discipline: DisciplineFile;
};

type LocatedPieceEntry = LocatedPieceFile["clauses"][number];

const readInstalledPieceFile = (request: PieceRequest): Result<LocatedPieceFile, VersionTwoLoadFailure> => {
  const names = readInstalledNames(request);
  if (names.outcome === "failed") {
    return names;
  }
  const clauses = everyOk({
    entries: request.discipline.clauses.filter((clause) => clause.kind === "mechanical" && clause.mechanisms.includes(request.mechanism)),
    resolve: ({ id }): Result<LocatedPieceEntry | undefined, VersionTwoLoadFailure> => {
      const installed = firstInstalledPieceFor({ ...request, names: names.value, clause: { ruleSet: TOOL_RULE_SET, discipline: request.discipline.id, clause: id } });
      if (installed.outcome === "failed") {
        return installed;
      }
      if (installed.value === undefined) {
        return { outcome: "ok", value: undefined };
      }
      const { pieceRoot, settings, declarations, editions } = installed.value.piece;
      return { outcome: "ok", value: { clause: id, pieceRoot, settings, clauseSettings: declarations, editions } };
    },
  });
  return clauses.outcome === "failed" ? clauses : { outcome: "ok", value: {
    version: 1, discipline: request.discipline.id, mechanism: request.mechanism, clauses: clauses.value.filter((entry) => entry !== undefined),
  } };
};

export const readLocatedPieceFile = (request: PieceRequest): Result<LocatedPieceFile, VersionTwoLoadFailure> => {
  if (request.ruleSetRoot === request.installRoot) {
    return readInstalledPieceFile(request);
  }
  const read = readPieceFile(request);
  if (read.outcome === "failed") {
    return read;
  }
  const pieceRoot = request.path.join({ segments: pieceFolderSegmentsOf({ ...request, discipline: request.discipline.id }) });
  return { outcome: "ok", value: { ...read.value, clauses: read.value.clauses.map((entry) => ({ ...entry, pieceRoot })) } };
};
