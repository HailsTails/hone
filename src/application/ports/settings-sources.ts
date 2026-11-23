import type { AnchorKind } from "../../domain/finding/anchor.ts";
import type {
  CheckAddressText,
  CheckNames,
} from "../../domain/language-layer/check-address-text.ts";
import type { CatalogueHolding } from "../../domain/language-layer/symptom-catalogue.ts";
import type { RecordKind } from "../../domain/language-layer/symptom-catalogue.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import type { ClauseEditions } from "../../domain/rule-set/edition-types.ts";
import type { EngineId } from "../../domain/rule-set/identifier-types.ts";
import type {
  ClauseExceptions,
  ClauseSettingDeclarations,
} from "../../domain/rule-set/rule-set-types.ts";
import type { DeclaredRuleSet } from "../../domain/settings/settings-file.ts";
import type { DirectoryPort } from "./file-system/directory-port.ts";
import type { FileTextPort } from "./file-system/file-text-port.ts";
import type { ModuleExtension } from "./host/module-extension.ts";
import type { PathPort } from "./host/path-port.ts";

export type SettingsDocument = { readonly path: string; readonly document: unknown };

export type PieceClause = {
  readonly exceptions: ClauseExceptions;
  readonly anchor: AnchorKind;
  readonly pieceRoot: string;
  readonly settings: unknown;
  readonly declarations: ClauseSettingDeclarations;
  readonly editions: ClauseEditions;
};

export type CheckPiece = PieceClause & {
  readonly forms: Readonly<Record<string, CheckAddressText>>;
};

export type CheckPieceSource = (request: {
  readonly ruleSetRoot: AbsolutePath;
  readonly names: CheckNames;
  readonly mechanism: EngineId;
}) => Result<CheckPiece, VersionTwoLoadFailure>;

export type SettingsSources = {
  readonly settingsFile: (
    request: Record<string, never>,
  ) => Result<SettingsDocument, VersionTwoLoadFailure>;
  readonly ruleSetRoot: (request: {
    readonly ruleSet: ClauseAddress["ruleSet"];
    readonly ruleSets: readonly DeclaredRuleSet[];
  }) => Result<AbsolutePath, VersionTwoLoadFailure>;
  readonly catalogue: (request: {
    readonly ruleSetRoot: AbsolutePath;
    readonly ruleSet: ClauseAddress["ruleSet"];
  }) => Result<CatalogueHolding, VersionTwoLoadFailure>;
};

export type SettingsSourceContext = {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly toolRecordKinds: readonly RecordKind[];
};

export type SettingsSourcesOf = (request: SettingsSourceContext) => SettingsSources;

export type CheckPieceSourceOf = (
  request: Pick<SettingsSourceContext, "fileText" | "path" | "installRoot" | "moduleExtension">,
) => CheckPieceSource;
