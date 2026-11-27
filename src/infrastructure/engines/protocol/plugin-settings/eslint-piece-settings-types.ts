import type { Edition } from "../../../../domain/rule-set/edition-types.ts";
import type { JsonValue } from "../../../../domain/settings/json-values/json-value.ts";

export type RuleOptions = readonly JsonValue[];

import type { CheckAddressText } from "../../../../domain/language-layer/check-address-text.ts";

export type EslintPieceSettings = {
  readonly pluginNamespace: string;
  readonly pluginModule: string;
  readonly rule: string;
  readonly authoredCheck?: CheckAddressText;
  readonly options?: RuleOptions;
  readonly optionsByEdition?: ReadonlyMap<Edition, RuleOptions>;
};
