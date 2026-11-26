import type { Result } from "../../../domain/result.ts";
import type { SettingsFile, SettingsFileFault } from "../../../domain/settings/settings-file.ts";

export const PROJECTION_KINDS = ["mjs", "ts"] as const;

export type ProjectionKind = (typeof PROJECTION_KINDS)[number];

export const DEFAULT_PROJECTION_KIND: ProjectionKind = "mjs";

export const listOtherProjectionKinds = (selected: ProjectionKind): readonly ProjectionKind[] =>
  PROJECTION_KINDS.filter((kind) => kind !== selected);

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
