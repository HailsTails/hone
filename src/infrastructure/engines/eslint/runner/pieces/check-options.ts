import {
  resolveCheckOptions,
  type CheckOptionBinding,
  type HoneCheckOptions,
  nonNullAssertionMessage,
} from "../../../../../domain/rule-set/check-options.ts";
import type { ClauseAddress } from "../../../../../domain/rule-set/clause-address-types.ts";
import type { Edition } from "../../../../../domain/rule-set/edition-types.ts";
import type {
  EslintPieceSettings,
  RuleOptions,
} from "../../../protocol/plugin-settings/eslint-piece-settings-types.ts";
import { ruleOptionsOf } from "../../../protocol/plugin-settings/rule-options.ts";
import {
  typescriptEslintClassOptions,
  typescriptEslintNamingOptions,
} from "../../../protocol/plugin-settings/typescript-eslint-options.ts";

const eslintArguments = (options: HoneCheckOptions): RuleOptions => {
  switch (options.kind) {
    case "parameter-count":
      return [{ max: options.maximumSlots, countVoidThis: options.voidReceiver === "count" }];
    case "parameter-reassignment":
      return [{ props: options.assignments === "binding-and-properties" }];
    case "static-members-only":
      return typescriptEslintClassOptions(options);
    case "naming-convention":
      return typescriptEslintNamingOptions(options);
    case "non-null-assertions":
      return options.rejects.map((assertion) => ({
        selector: assertion === "asserted-value" ? "TSNonNullExpression" : "[definite=true]",
        message: nonNullAssertionMessage[assertion],
      }));
    case "skipped-tests":
      return options.coverage === "including-conditional-and-todo" ? ["conditional-and-todo"] : [];
  }
};

export const readEslintCheckOptions = (request: {
  readonly settings: EslintPieceSettings;
  readonly edition: Edition;
  readonly checkOptions: CheckOptionBinding["checkOptions"];
}): RuleOptions => {
  const { checkOptions } = request;
  if (checkOptions.kind === "none") return [];
  return checkOptions.kind === "piece" ? ruleOptionsOf(request) : eslintArguments(checkOptions);
};

export const readLegacyEslintCheckOptions = (request: {
  readonly address: ClauseAddress;
  readonly settings: EslintPieceSettings;
  readonly edition: Edition;
}): RuleOptions => {
  const named = request.settings.authoredCheck;
  if (named === undefined) return ruleOptionsOf(request);
  const { checkOptions } = resolveCheckOptions({
    address: named,
    ruleSet: request.address.ruleSet,
    edition: request.edition,
  });
  return readEslintCheckOptions({ ...request, checkOptions });
};
