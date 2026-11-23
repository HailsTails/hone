import type { Result } from "../../result.ts";
import type { ClauseEditions, Edition } from "../../rule-set/edition-types.ts";
import type {
  ClauseSettingDeclaration,
  ClauseSettingDeclarations,
} from "../../rule-set/rule-set-types.ts";
import type { ClauseSettingValues } from "../../runner/runner-module-types.ts";
import { JSON_KIND_NAMES, jsonKindOf, sameJsonValue } from "../json-values/json-kind.ts";
import type { ReadonlyJsonValue } from "../json-values/json-value.ts";
import { listedAddressText } from "../listed-address.ts";
import type { GivenCheckSettings } from "../settings-file.ts";
import type { CheckEditions } from "./check-editions.ts";
import { defaultClauseSettings } from "./default-clause-settings.ts";
import { editionPinOf } from "./edition-pin.ts";

export type SettledCheckSettings = {
  readonly clauseSettings: ClauseSettingValues;
  readonly edition: Edition;
};

type SettingsRequest = {
  readonly given: GivenCheckSettings | undefined;
  readonly declarations: ClauseSettingDeclarations;
  readonly editions: ClauseEditions;
  readonly checkEditions: CheckEditions;
};

const listed = (request: { readonly values: readonly ReadonlyJsonValue[] }): string =>
  request.values.map((choice) => JSON.stringify(choice)).join(", ");

const refused = (request: {
  readonly given: GivenCheckSettings;
  readonly detail: string;
}): Result<never, string> => ({
  outcome: "failed",
  error: `checkSettings for ${listedAddressText({ address: request.given.address })}: ${request.detail}`,
});

const UNPINNED_EDITIONS: Readonly<Record<CheckEditions, (editions: ClauseEditions) => Edition>> = {
  pinned: (editions) => editions.default,
  latest: (editions) => editions.latest,
};

const unpinnedEditionOf = (request: {
  readonly editions: ClauseEditions;
  readonly checkEditions: CheckEditions;
}): Edition => UNPINNED_EDITIONS[request.checkEditions](request.editions);

const settledEditionOf = (
  request: SettingsRequest & {
    readonly given: GivenCheckSettings;
    readonly pin: ReadonlyJsonValue | undefined;
  },
): Result<Edition, string> => {
  if (request.pin === undefined) {
    return { outcome: "ok", value: unpinnedEditionOf(request) };
  }
  const pinned = request.editions.declared.find((edition) => edition === request.pin);
  return pinned === undefined
    ? refused({
        given: request.given,
        detail: `edition must be one of ${listed({ values: request.editions.declared })}`,
      })
    : { outcome: "ok", value: pinned };
};

const settingRefusalOf = (request: {
  readonly name: string;
  readonly given: ReadonlyJsonValue;
  readonly declaration: ClauseSettingDeclaration | undefined;
  readonly declarations: ClauseSettingDeclarations;
}): string | undefined => {
  if (request.declaration === undefined) {
    const taken = Object.keys(request.declarations);
    return `its check takes no ${request.name}; it takes ${taken.join(", ")}`;
  }
  const kind = jsonKindOf({ value: request.declaration.default });
  if (jsonKindOf({ value: request.given }) !== kind) {
    return `${request.name} must be ${JSON_KIND_NAMES[kind]}, as its default is`;
  }
  const choices = request.declaration.choices;
  return choices === undefined ||
    choices.some((choice) => sameJsonValue({ left: choice, right: request.given }) === "same")
    ? undefined
    : `${request.name} must be one of ${listed({ values: choices })}`;
};

const pieceSettingsOf = (
  request: SettingsRequest & {
    readonly given: GivenCheckSettings;
    readonly rest: ClauseSettingValues | undefined;
  },
): Result<ClauseSettingValues, string> => {
  const defaults = defaultClauseSettings({ declarations: request.declarations });
  if (request.rest === undefined) {
    return { outcome: "ok", value: defaults };
  }
  if (Object.keys(request.declarations).length === 0) {
    return refused({ given: request.given, detail: "its check takes no settings" });
  }
  const given = Object.entries(request.rest);
  const detail = given
    .map(([name, setting]) =>
      settingRefusalOf({
        name,
        given: setting,
        declaration: Object.hasOwn(request.declarations, name)
          ? request.declarations[name]
          : undefined,
        declarations: request.declarations,
      }),
    )
    .find((refusal) => refusal !== undefined);
  return detail === undefined
    ? { outcome: "ok", value: { ...defaults, ...request.rest } }
    : refused({ given: request.given, detail });
};

export const settledCheckSettings = (
  request: SettingsRequest,
): Result<SettledCheckSettings, string> => {
  const given = request.given;
  if (given === undefined) {
    return {
      outcome: "ok",
      value: {
        clauseSettings: defaultClauseSettings({ declarations: request.declarations }),
        edition: unpinnedEditionOf(request),
      },
    };
  }
  const { pin, rest } = editionPinOf({ given: given.values });
  const edition = settledEditionOf({ ...request, given, pin });
  if (edition.outcome === "failed") {
    return edition;
  }
  const clauseSettings = pieceSettingsOf({ ...request, given, rest });
  return clauseSettings.outcome === "failed"
    ? clauseSettings
    : { outcome: "ok", value: { clauseSettings: clauseSettings.value, edition: edition.value } };
};
