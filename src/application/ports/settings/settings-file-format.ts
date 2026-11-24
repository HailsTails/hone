import type { Result } from "../../../domain/result.ts";
import type { SettingsFile, SettingsFileFault } from "../../../domain/settings/settings-file.ts";

export type CheckListingKey = Extract<keyof SettingsFile, "checks" | "checkSettings">;

export type RenamedCheck = {
  readonly under: CheckListingKey;
  readonly from: string;
  readonly to: string;
};

export type ListedChecks = { readonly under: CheckListingKey; readonly checks: readonly string[] };

export type KeysRenamed = {
  readonly text: string;
  readonly renamed: readonly RenamedCheck[];
  readonly listed: readonly ListedChecks[];
};

export type KeysUnrenamed =
  | Extract<SettingsFileFault, { readonly kind: "malformed" }>
  | {
      readonly kind: "renamed-address-outside-listings";
      readonly listings: readonly CheckListingKey[];
    };

export type SettingsFileFormat = {
  readonly fileOf: (request: {
    readonly document: unknown;
  }) => Result<SettingsFile, SettingsFileFault>;
  readonly documentOf: (request: { readonly settings: SettingsFile }) => unknown;
  readonly textOf: (request: { readonly settings: SettingsFile }) => string;
  readonly renameKeys: (request: {
    readonly text: string;
    readonly under: readonly CheckListingKey[];
    readonly rename: (request: { readonly text: string }) => string;
  }) => Result<KeysRenamed, KeysUnrenamed>;
};
