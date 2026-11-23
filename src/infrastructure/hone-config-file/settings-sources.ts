import type { DirectoryPort } from "../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { ModuleExtension } from "../../application/ports/host/module-extension.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import type {
  CheckPieceSource,
  SettingsDocument,
  SettingsSources,
} from "../../application/ports/settings-sources.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";
import { SETTINGS_FILE_NAME } from "../../domain/settings/settings-file.ts";
import { parsedJson } from "../content-files/parsed-json.ts";
import { readBoundCatalogue } from "../content-files/symptom-catalogues/bound-catalogue.ts";
import { checkPieceOf, readNamedPiece } from "../engines/named-piece.ts";
import { runnerModuleSegmentsOf } from "../node/modules/install-layout.ts";
import { ruleSetRootOf } from "./rule-set-root.ts";

type SourcesOptions = {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
};

const failed = (
  error: VersionTwoLoadFailure,
): { readonly outcome: "failed"; readonly error: VersionTwoLoadFailure } => ({
  outcome: "failed",
  error,
});

const settingsDocumentOf = (
  request: SourcesOptions,
): Result<SettingsDocument, VersionTwoLoadFailure> => {
  const path = request.path.join({ segments: [request.repoRoot, SETTINGS_FILE_NAME] });
  if (request.fileText.exists({ path }) === "absent") {
    return failed({ kind: "selection-absent", repo: request.repoRoot });
  }
  const text = request.fileText.read({ path });
  if (text.outcome === "failed") {
    return failed({ kind: "file-unreadable", path, detail: text.error.detail });
  }
  const document = parsedJson({ text: text.value });
  return document.outcome === "failed"
    ? failed({ kind: "file-malformed", path, detail: document.error })
    : { outcome: "ok", value: { path, document: document.value } };
};

export const createSettingsSources = (options: SourcesOptions): SettingsSources => ({
  settingsFile: (_request) => settingsDocumentOf(options),
  ruleSetRoot: (request) =>
    ruleSetRootOf({
      ruleSet: request.ruleSet,
      ruleSets: request.ruleSets,
      repoRoot: options.repoRoot,
      installRoot: options.installRoot,
      path: options.path,
    }),
  catalogue: (request) =>
    readBoundCatalogue({
      fileText: options.fileText,
      directory: options.directory,
      path: options.path,
      ruleSetRoot: request.ruleSetRoot,
      ruleSet: request.ruleSet,
      installRoot: options.installRoot,
    }),
});

export const createCheckPieceSource =
  (options: Omit<SourcesOptions, "directory" | "repoRoot">): CheckPieceSource =>
  (request) => {
    const runnerPath = options.path.join({
      segments: runnerModuleSegmentsOf({
        installRoot: options.installRoot,
        mechanism: request.mechanism,
        moduleExtension: options.moduleExtension,
      }),
    });
    if (options.fileText.exists({ path: runnerPath }) === "absent") {
      return failed({ kind: "runner-missing", mechanism: request.mechanism });
    }
    const piece = readNamedPiece({
      ...options,
      ...request.names,
      ruleSetRoot: request.ruleSetRoot,
      mechanism: request.mechanism,
    });
    if (piece.outcome === "failed") return piece;
    return { outcome: "ok", value: checkPieceOf(piece.value) };
  };
