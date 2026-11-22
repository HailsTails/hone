import { z } from "zod";
import type { EngineBindingsRepository } from "../../application/ports/engine-bindings-repository.ts";
import type { DirectoryPort } from "../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import { type EngineBindings, type PieceClauseKey, pieceClauseKeyOf } from "../../domain/language-layer/catalogue-binding.ts";
import type { CheckContent, Engine } from "../../domain/language-layer/symptom-catalogue.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";
import { engineFolderOf, enginesFolderSegmentsOf } from "../../domain/rule-set/piece-folder.ts";
import { absolutePathSchema } from "../content-files/absolute-path.ts";
import { pieceFileSchema, readVersionOneJson } from "../content-files/rule-sets/rule-set-reader.ts";
import { checkAddressTextOf, checkNamesOf } from "../../domain/language-layer/check-address-text.ts";
import { readNamedPiece } from "./named-piece.ts";
import { ENGINE_REGISTRY } from "./engine-registry.ts";

type PieceSource = {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly path: Pick<PathPort, "join">;
  readonly ruleSetRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
};

type Binding = { readonly key: PieceClauseKey; readonly engine: Engine };

type Bound = Result<readonly Binding[], VersionTwoLoadFailure>;

const PIECE_FILE = "piece.json";

const allBound = (bounds: readonly Bound[]): Bound => {
  const failure = bounds.find((bound) => bound.outcome === "failed");
  return failure ?? { outcome: "ok", value: bounds.flatMap((bound) => (bound.outcome === "ok" ? bound.value : [])) };
};

const bindingsOfPiece = (request: { readonly source: PieceSource; readonly engine: Engine; readonly mechanismFolder: AbsolutePath; readonly piece: string }): Bound => {
  const path = request.source.path.join({ segments: [request.mechanismFolder, request.piece, PIECE_FILE] });
  if (request.source.fileText.exists({ path }) === "absent") {
    return { outcome: "ok", value: [] };
  }
  const document = readVersionOneJson({ fileText: request.source.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const piece = pieceFileSchema.safeParse(document.value);
  return piece.success
    ? {
        outcome: "ok",
        value: piece.data.clauses.map((entry) => ({ key: pieceClauseKeyOf({ discipline: piece.data.discipline, clause: entry.clause }), engine: request.engine })),
      }
    : { outcome: "failed", error: { kind: "file-malformed", path, detail: z.prettifyError(piece.error) } };
};

const bindingsOfEngine = (request: { readonly source: PieceSource; readonly enginesFolder: readonly string[]; readonly engine: Engine }): Bound => {
  const joined = request.source.path.join({ segments: [...request.enginesFolder, engineFolderOf({ ...request.source, mechanism: request.engine.name })] });
  const mechanismFolder = absolutePathSchema.safeParse(joined);
  if (!mechanismFolder.success) {
    return { outcome: "failed", error: { kind: "file-unreadable", path: joined, detail: "is not an absolute path" } };
  }
  if (request.source.fileText.exists({ path: mechanismFolder.data }) === "absent") {
    return { outcome: "ok", value: [] };
  }
  const entries = request.source.directory.list({ path: mechanismFolder.data });
  if (entries.outcome === "failed") {
    return { outcome: "failed", error: { kind: "file-unreadable", path: entries.error.path, detail: entries.error.detail } };
  }
  const pieces = entries.value.filter((entry) => entry.kind === "directory").map((entry) => entry.name);
  return allBound(pieces.toSorted().map((piece) => bindingsOfPiece({ source: request.source, engine: request.engine, mechanismFolder: mechanismFolder.data, piece })));
};

const bindingsByKey = (bindings: readonly Binding[]): EngineBindings =>
  new Map(
    [...new Set(bindings.map((binding) => binding.key))].map((key): readonly [PieceClauseKey, readonly Engine[]] => [
      key,
      [...new Map(bindings.filter((binding) => binding.key === key).map(({ engine }) => [engine.name, engine])).values()],
    ]),
  );

const namedBindingOf = (request: { readonly source: PieceSource; readonly engine: Engine; readonly check: CheckContent }): Bound => {
  const names = checkNamesOf({ text: checkAddressTextOf(request) });
  if (names === undefined) {
    return { outcome: "ok", value: [] };
  }
  const piece = readNamedPiece({ ...request.source, ...names, mechanism: request.engine.name });
  if (piece.outcome === "ok") {
    return { outcome: "ok", value: [{ key: pieceClauseKeyOf(request.check.clause), engine: request.engine }] };
  }
  return piece.error.kind === "piece-missing" ? { outcome: "ok", value: [] } : piece;
};

const readEngineBindings = (source: PieceSource, checks: readonly CheckContent[]): Result<EngineBindings, VersionTwoLoadFailure> => {
  const enginesFolder = [source.ruleSetRoot, ...enginesFolderSegmentsOf(source)];
  const installed = source.ruleSetRoot === source.installRoot;
  const bound = allBound(ENGINE_REGISTRY.flatMap((engine) => installed
    ? checks.map((check) => namedBindingOf({ source, engine, check }))
    : [bindingsOfEngine({ source, enginesFolder, engine })]));
  return bound.outcome === "failed" ? bound : { outcome: "ok", value: bindingsByKey(bound.value) };
};

export const createEngineBindingsRepository = (options: PieceSource): EngineBindingsRepository => ({
  read: (request) => readEngineBindings(options, request.checks ?? []),
});
