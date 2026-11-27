import type { Edition } from "../../../../domain/rule-set/edition-types.ts";
import type { RuleOptions } from "../../../../domain/runner/check-binding.ts";

export type EslintPieceSettings = {
  readonly pluginNamespace: string;
  readonly pluginModule: string;
  readonly rule: string;
  readonly options?: RuleOptions;
  readonly optionsByEdition?: ReadonlyMap<Edition, RuleOptions>;
};
