import { z } from "zod";

import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import type { CheckPiece, PieceClause } from "../../application/ports/settings-sources.ts";
import { isCatalogueName, type CatalogueName } from "../../domain/language-layer/catalogue-name.ts";
import {
  checkAddressOfNames,
  type CheckNames,
} from "../../domain/language-layer/check-address-text.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { Result } from "../../domain/result.ts";
import type { AuthoredPieceDeclaration } from "../../domain/rule-set/authored-rule-set-types.ts";
import type { EngineId } from "../../domain/rule-set/identifier-types.ts";
import { namedPieceFolderSegmentsOf } from "../../domain/rule-set/piece-folder.ts";
import { parsedJson } from "../content-files/parsed-json.ts";
import { anchorKindSchema, pieceFileSchema } from "../content-files/rule-sets/rule-set-reader.ts";
import type { DeepReadonly, Equal } from "./protocol/runner-module/type-equality.ts";

const legacyPieceEntry = pieceFileSchema.shape.clauses.element.shape;

const catalogueNameSchema = z.string().refine(isCatalogueName);

export const namedPieceImplementationSchema = z.strictObject({
  symptom: catalogueNameSchema,
  check: catalogueNameSchema,
});

export type NamedPiece = PieceClause & {
  readonly forms: Readonly<Record<string, CheckNames>>;
  readonly declarationPath: string;
  readonly exampleOwner: CheckNames;
  readonly examplesPath: string;
};

const checkDeclaration = {
  version: z.literal(2),
  exceptions: z.enum(["allowed", "refused"]).default("allowed"),
  checkSettings: legacyPieceEntry.clauseSettings,
};

const implementationSchema = z.strictObject({
  ...checkDeclaration,
  anchor: anchorKindSchema,
  settings: z.record(z.string(), z.json()),
  forms: z.record(z.string(), namedPieceImplementationSchema).default({}),
  editions: legacyPieceEntry.editions,
});

const SHARED_SETTING_FIELDS: ReadonlySet<string> = new Set([
  "module",
  "pluginModule",
  "pluginNamespace",
]);

const pointerSchema = z.strictObject({
  ...checkDeclaration,
  anchor: anchorKindSchema.optional(),
  settings: z
    .record(z.string(), z.json())
    .refine((settings) => Object.keys(settings).every((key) => !SHARED_SETTING_FIELDS.has(key)), {
      error: "implementation settings belong to the referenced declaration",
    })
    .default({}),
  implementation: namedPieceImplementationSchema,
  examples: z.literal("with-implementation").optional(),
});

const namedPieceSchema = z.union([implementationSchema, pointerSchema]);

export const isAuthoredPieceDeclarationSchemaEqual: Equal<
  DeepReadonly<z.input<typeof namedPieceSchema>>,
  AuthoredPieceDeclaration
> = true;

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
    return {
      outcome: "failed",
      error: {
        kind: "file-unreadable",
        path: request.path,
        detail: `${request.address}: ${text.error.detail}`,
      },
    };
  }
  const document = parsedJson({ text: text.value });
  if (document.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: request.path,
        detail: `${request.address}: ${document.error}`,
      },
    };
  }
  const piece = namedPieceSchema.safeParse(document.value);
  return piece.success
    ? { outcome: "ok", value: piece.data }
    : {
        outcome: "failed",
        error: {
          kind: "file-malformed",
          path: request.path,
          detail: `${request.address}: ${z.prettifyError(piece.error)}`,
        },
      };
};

export const namedPiecePathOf = (request: Omit<NamedPieceRequest, "fileText">): string =>
  request.path.join({ segments: [...namedPieceFolderSegmentsOf(request), "piece.json"] });

type PieceDeclaration = z.output<typeof namedPieceSchema>;

const declarationAt = (
  request: NamedPieceRequest & { readonly declarationPath: string },
): Result<PieceDeclaration, VersionTwoLoadFailure> => {
  const address = `${request.symptom}#${request.check}`;
  const path = request.declarationPath;
  if (request.fileText.exists({ path }) === "absent") {
    return {
      outcome: "failed",
      error: { kind: "piece-missing", address, mechanism: request.mechanism },
    };
  }
  return readPieceDeclaration({ fileText: request.fileText, path, address });
};

type PieceImplementation = z.output<typeof implementationSchema>;

const sharedPieceAt = (
  request: NamedPieceRequest,
): Result<PieceImplementation, VersionTwoLoadFailure> => {
  const declarationPath = namedPiecePathOf(request);
  const shared = declarationAt({ ...request, declarationPath });
  if (shared.outcome === "failed") {
    return shared.error.kind === "piece-missing"
      ? {
          outcome: "failed",
          error: {
            kind: "file-malformed",
            path: declarationPath,
            detail: "referenced implementation is missing",
          },
        }
      : shared;
  }
  return "implementation" in shared.value
    ? {
        outcome: "failed",
        error: {
          kind: "file-malformed",
          path: declarationPath,
          detail: "an implementation reference must point to a piece declaring its implementation",
        },
      }
    : { outcome: "ok", value: shared.value };
};

export const readNamedPiece = (
  request: NamedPieceRequest,
): Result<NamedPiece, VersionTwoLoadFailure> => {
  const declarationPath = namedPiecePathOf(request);
  const declared = declarationAt({ ...request, declarationPath });
  if (declared.outcome === "failed") return declared;
  const piece = declared.value;
  const localCheck = { symptom: request.symptom, check: request.check };
  const implementation = "implementation" in piece ? piece.implementation : localCheck;
  const shared: Result<PieceImplementation, VersionTwoLoadFailure> =
    "implementation" in piece
      ? sharedPieceAt({ ...request, ...implementation })
      : { outcome: "ok", value: piece };
  if (shared.outcome === "failed") return shared;
  const owner = shared.value;
  const exampleOwner =
    "examples" in piece && piece.examples === "with-implementation" ? implementation : localCheck;
  return {
    outcome: "ok",
    value: {
      anchor: piece.anchor ?? owner.anchor,
      exceptions: piece.exceptions,
      settings: { ...owner.settings, ...piece.settings },
      declarations: piece.checkSettings,
      editions: owner.editions,
      forms: owner.forms,
      declarationPath,
      exampleOwner,
      examplesPath: request.path.join({
        segments: [
          ...namedPieceFolderSegmentsOf({ ...request, ...exampleOwner }),
          `${exampleOwner.check}.examples.json`,
        ],
      }),
      pieceRoot: request.path.join({
        segments: namedPieceFolderSegmentsOf({ ...request, ...implementation }),
      }),
    },
  };
};

export const checkPieceOf = (piece: NamedPiece): CheckPiece => ({
  anchor: piece.anchor,
  exceptions: piece.exceptions,
  pieceRoot: piece.pieceRoot,
  settings: piece.settings,
  declarations: piece.declarations,
  editions: piece.editions,
  forms: Object.fromEntries(
    Object.entries(piece.forms).map(([form, name]) => [form, checkAddressOfNames(name)]),
  ),
});
