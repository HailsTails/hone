import { z } from "zod";
import type { ClauseSettingValues } from "../../domain/runner/runner-module-types.ts";
import type { ClauseSettingDeclaration, ClauseSettingDeclarations } from "../../domain/rule-set/rule-set-types.ts";
import { defaultClauseSettings } from "../../domain/settings/clause-settings/default-clause-settings.ts";
import { clauseAddressSchema } from "../discipline-exceptions-folder/clause-address.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../domain/rule-set/clause-address.ts";
import { JSON_KIND_NAMES, jsonKindOf, sameJsonValue } from "../../domain/settings/json-values/json-kind.ts";
import type { ReadonlyJsonValue } from "../../domain/settings/json-values/json-value.ts";
import type { Result } from "../../domain/result.ts";
import type { ClauseSettings } from "../../domain/settings/clause-settings/clause-settings.ts";
import type { DeepReadonlyKeepingTuples, Equal } from "../engines/protocol/runner-module/type-equality.ts";

export const clauseSettingsSchema = z
  .record(z.string(), z.record(z.string(), z.json()))
  .transform((settings, context) =>
    Object.entries(settings).flatMap(([key, values]): readonly (readonly [ClauseAddress, typeof values])[] => {
      const address = clauseAddressSchema.safeParse(key);
      if (address.success) return [[address.data, values]];
      context.addIssue({ code: "custom", input: key, path: [key], message: `clauseSettings for ${key}: not a clause address` });
      return [];
    }),
  );

export const isClauseSettingsEqual: Equal<DeepReadonlyKeepingTuples<z.output<typeof clauseSettingsSchema>>, ClauseSettings> = true;

type GivenSetting = { readonly key: string; readonly value: ReadonlyJsonValue };

const refusal = (request: { readonly address: ClauseAddress; readonly detail: string }): Result<never, string> => ({
  outcome: "failed",
  error: `clauseSettings for ${clauseAddressText({ address: request.address })}: ${request.detail}`,
});

const listed = (request: { readonly values: readonly ReadonlyJsonValue[] }): string =>
  request.values.map((choice) => JSON.stringify(choice)).join(", ");

const settingRefusalOf = (request: {
  readonly given: GivenSetting;
  readonly declaration: ClauseSettingDeclaration | undefined;
  readonly declarations: ClauseSettingDeclarations;
}): string | undefined => {
  const { given, declaration } = request;
  if (declaration === undefined) {
    return `its piece takes no ${given.key}; it takes ${Object.keys(request.declarations).join(", ")}`;
  }
  const kind = jsonKindOf({ value: declaration.default });
  if (jsonKindOf({ value: given.value }) !== kind) return `${given.key} must be ${JSON_KIND_NAMES[kind]}, as its default is`;
  const choices = declaration.choices;
  if (choices !== undefined && !choices.some((choice) => sameJsonValue({ left: choice, right: given.value }) === "same")) {
    return `${given.key} must be one of ${listed({ values: choices })}`;
  }
  return undefined;
};

export const settledClauseSettings = (request: {
  readonly address: ClauseAddress;
  readonly declarations: ClauseSettingDeclarations;
  readonly given: ClauseSettingValues | undefined;
}): Result<ClauseSettingValues, string> => {
  const defaults = defaultClauseSettings(request);
  if (request.given === undefined) return { outcome: "ok", value: defaults };
  if (Object.keys(request.declarations).length === 0) return refusal({ address: request.address, detail: "its piece takes no settings" });
  const detail = Object.entries(request.given)
    .map(([key, settingValue]) =>
      settingRefusalOf({
        given: { key, value: settingValue },
        declaration: Object.hasOwn(request.declarations, key) ? request.declarations[key] : undefined,
        declarations: request.declarations,
      }),
    )
    .find((found) => found !== undefined);
  if (detail !== undefined) return refusal({ address: request.address, detail });
  return { outcome: "ok", value: { ...defaults, ...request.given } };
};
