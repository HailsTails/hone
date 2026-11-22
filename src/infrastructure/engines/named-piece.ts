import { z } from "zod";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import type { PieceClause } from "../../application/ports/settings-sources.ts";
import { isCatalogueName, type CatalogueName } from "../../domain/language-layer/catalogue-name.ts";
import type { CheckNames } from "../../domain/language-layer/check-address-text.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { Result } from "../../domain/result.ts";
import type { EngineId } from "../../domain/rule-set/identifier-types.ts";
import { namedPieceFolderSegmentsOf } from "../../domain/rule-set/piece-folder.ts";
import { parsedJson } from "../content-files/parsed-json.ts";
import { anchorKindSchema, pieceFileSchema } from "../content-files/rule-sets/rule-set-reader.ts";

const legacyPieceEntry = pieceFileSchema.shape.clauses.element.shape;

const catalogueNameSchema = z.string().refine(isCatalogueName);

export const namedPieceImplementationSchema = z.strictObject({ symptom: catalogueNameSchema, check: catalogueNameSchema });

export type NamedPiece = PieceClause & {
  readonly forms: Readonly<Record<string, CheckNames>>;
  readonly examplesPath: string;
};

const namedPieceSchema = z.strictObject({
  version: z.literal(2),
  anchor: anchorKindSchema,
  exceptions: z.enum(["allowed", "refused"]).default("allowed"),
  settings: z.json(),
  implementation: namedPieceImplementationSchema.optional(),
  forms: z.record(z.string(), namedPieceImplementationSchema).default({}),
  examples: z.literal("with-implementation").optional(),
  clauseSettings: legacyPieceEntry.clauseSettings,
  editions: legacyPieceEntry.editions,
});

type NamedPieceRequest = {
  readonly fileText: Pick<FileTextPort, "exists" | "read">;
  readonly path: Pick<PathPort, "join">;
  readonly installRoot: string;
  readonly ruleSetRoot: string;
  readonly mechanism: EngineId;
  readonly symptom: CatalogueName;
  readonly check: CatalogueName;
};

const readPieceDeclaration = (request: {
  readonly fileText: Pick<FileTextPort, "read">;
  readonly path: string;
  readonly address: string;
}): Result<z.output<typeof namedPieceSchema>, VersionTwoLoadFailure> => {
  const text = request.fileText.read({ path: request.path });
  if (text.outcome === "failed") {
    return { outcome: "failed", error: { kind: "file-unreadable", path: request.path, detail: `${request.address}: ${text.error.detail}` } };
  }
  const document = parsedJson({ text: text.value });
  if (document.outcome === "failed") {
    return { outcome: "failed", error: { kind: "file-malformed", path: request.path, detail: `${request.address}: ${document.error}` } };
  }
  const piece = namedPieceSchema.safeParse(document.value);
  return piece.success ? { outcome: "ok", value: piece.data } : {
    outcome: "failed", error: { kind: "file-malformed", path: request.path, detail: `${request.address}: ${z.prettifyError(piece.error)}` },
  };
};

export const namedPiecePathOf = (request: Omit<NamedPieceRequest, "fileText">): string =>
  request.path.join({ segments: [...namedPieceFolderSegmentsOf(request), "piece.json"] });

export const readNamedPiece = (request: NamedPieceRequest): Result<NamedPiece, VersionTwoLoadFailure> => {
  const address = `${request.symptom}#${request.check}`;
  const path = namedPiecePathOf(request);
  if (request.fileText.exists({ path }) === "absent") {
    return { outcome: "failed", error: { kind: "piece-missing", address, mechanism: request.mechanism } };
  }
  const declared = readPieceDeclaration({ fileText: request.fileText, path, address });
  if (declared.outcome === "failed") return declared;
  const { anchor, exceptions, settings, clauseSettings, editions, forms, implementation, examples } = declared.value;
  const implementationRoot = namedPieceFolderSegmentsOf({ ...request, ...implementation });
  const exampleOwner = examples === "with-implementation" && implementation !== undefined ? { ...request, ...implementation } : request;
  const examplesPath = request.path.join({ segments: [...namedPieceFolderSegmentsOf(exampleOwner), `${exampleOwner.check}.examples.json`] });
  return { outcome: "ok", value: {
    anchor, exceptions, settings, declarations: clauseSettings, editions, forms, examplesPath,
    pieceRoot: request.path.join({ segments: implementationRoot }),
  } };
};
