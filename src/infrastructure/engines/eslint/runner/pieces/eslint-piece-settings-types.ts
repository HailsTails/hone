import type { JsonValue } from "../../../../../domain/settings/json-values/json-value.ts";

export type RuleOptions = readonly JsonValue[];

export type EslintPieceSettings = {
  readonly pluginNamespace: string;
  readonly pluginModule: string;
  readonly rule: string;
  readonly options?: RuleOptions;
};
