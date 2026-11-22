import type { Result } from "../../../domain/result.ts";
import type { SettingsFile, SettingsFileFault } from "../../../domain/settings/settings-file.ts";

export type SettingsFileFormat = {
  readonly fileOf: (request: {
    readonly document: unknown;
  }) => Result<SettingsFile, SettingsFileFault>;
  readonly documentOf: (request: { readonly settings: SettingsFile }) => unknown;
  readonly textOf: (request: { readonly settings: SettingsFile }) => string;
};
