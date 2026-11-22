import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import {
  checkAddressOfNames,
  type CheckNames,
} from "../../../domain/language-layer/check-address-text.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import { everyOk } from "../../../domain/settings/every-ok.ts";
import {
  checksNamedFor,
  readVersionOneNames,
  VERSION_ONE_NAMES_SEGMENTS,
  type VersionOneNames,
} from "../../disciplines-file/version-one-names.ts";
import { readNamedPiece, type NamedPiece } from "../../engines/named-piece.ts";
import type { CatalogueFile } from "../symptom-catalogues/symptom-catalogue-wire.ts";

type InstallFiles = {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly installRoot: AbsolutePath;
};

type InstalledPiece = {
  readonly mechanism: EngineId;
  readonly examplesPath: string;
  readonly piece: NamedPiece;
};

type InstallPieceRead = Result<InstalledPiece | undefined, VersionTwoLoadFailure>;

export const installedNamesPathOf = (request: Omit<InstallFiles, "fileText">): string =>
  request.path.join({ segments: [request.installRoot, ...VERSION_ONE_NAMES_SEGMENTS] });

export const readInstalledNames = (
  request: InstallFiles,
): Result<VersionOneNames, VersionTwoLoadFailure> =>
  readVersionOneNames({ fileText: request.fileText, path: installedNamesPathOf(request) });

const installedPieceOf = (
  request: InstallFiles & CheckNames & { readonly mechanism: EngineId },
): InstallPieceRead => {
  const location = { ...request, ruleSetRoot: request.installRoot };
  const piece = readNamedPiece(location);
  if (piece.outcome === "failed") {
    return piece.error.kind === "piece-missing" ? { outcome: "ok", value: undefined } : piece;
  }
  return {
    outcome: "ok",
    value: {
      mechanism: request.mechanism,
      examplesPath: piece.value.examplesPath,
      piece: piece.value,
    },
  };
};

const firstPieceFrom = (
  request: InstallFiles & {
    readonly checks: readonly CheckNames[];
    readonly mechanism: EngineId;
  },
): InstallPieceRead => {
  const [check, ...remaining] = request.checks;
  if (check === undefined) {
    return { outcome: "ok", value: undefined };
  }
  const held = installedPieceOf({ ...request, ...check });
  return held.outcome === "failed" || held.value !== undefined
    ? held
    : firstPieceFrom({ ...request, checks: remaining });
};

export const firstInstalledPieceFor = (
  request: InstallFiles & {
    readonly names: VersionOneNames;
    readonly clause: ClauseAddress;
    readonly mechanism: EngineId;
  },
): InstallPieceRead => firstPieceFrom({ ...request, checks: checksNamedFor(request) });

export const installedPiecesFor = (
  request: InstallFiles & {
    readonly names: VersionOneNames;
    readonly clause: ClauseAddress;
    readonly mechanisms: readonly EngineId[];
  },
): Result<readonly InstalledPiece[], VersionTwoLoadFailure> => {
  const held = everyOk({
    entries: request.mechanisms,
    resolve: (mechanism) => firstInstalledPieceFor({ ...request, mechanism }),
  });
  return held.outcome === "failed"
    ? held
    : { outcome: "ok", value: held.value.filter((piece) => piece !== undefined) };
};

export const catalogueClausesOf = (
  request: InstallFiles & { readonly names: VersionOneNames },
): Result<CatalogueFile["clauses"], VersionTwoLoadFailure> => {
  const forms = everyOk({
    entries: request.names.claimsPieceForms,
    resolve: (clause): Result<CatalogueFile["clauses"][number], VersionTwoLoadFailure> => {
      const first = firstInstalledPieceFor({ ...request, clause, mechanism: "walker" });
      if (first.outcome === "failed") {
        return first;
      }
      const forms = Object.entries(first.value?.piece.forms ?? {});
      if (first.value === undefined || forms.length === 0) {
        return {
          outcome: "failed",
          error: {
            kind: "rule-set-invalid",
            path: installedNamesPathOf(request),
            detail: `no piece declares the forms of ${clauseAddressText({ address: clause })}`,
          },
        };
      }
      const names = new Set(
        checksNamedFor({ names: request.names, clause }).map(checkAddressOfNames),
      );
      const unknown = forms.find(([, check]) => !names.has(checkAddressOfNames(check)));
      if (unknown !== undefined) {
        const [section, check] = unknown;
        return {
          outcome: "failed",
          error: {
            kind: "file-malformed",
            path: first.value.piece.declarationPath,
            detail: `form ${section} names unregistered check ${checkAddressOfNames(check)}`,
          },
        };
      }
      return {
        outcome: "ok",
        value: {
          clause,
          sight: {
            kind: "symptom-by-form",
            forms: forms.map(([section, { symptom }]) => ({ section, symptom })),
          },
        },
      };
    },
  });
  return forms.outcome === "failed"
    ? forms
    : { outcome: "ok", value: [...request.names.clauses, ...forms.value] };
};
