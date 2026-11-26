import type { Result } from "../../../domain/result.ts";
import type { SettingsFile, SettingsFileFault } from "../../../domain/settings/settings-file.ts";

export type ProjectionKind = "mjs" | "ts";

export type VersionTwoSettingsFile = SettingsFile & {
  readonly eslintProjectionKind: ProjectionKind;
};

export type SettingsFileFormat = {
  readonly fileOf: (request: {
    readonly document: unknown;
  }) => Result<VersionTwoSettingsFile, SettingsFileFault>;
  readonly documentOf: (request: { readonly settings: VersionTwoSettingsFile }) => unknown;
  readonly textOf: (request: { readonly settings: VersionTwoSettingsFile }) => string;
};
