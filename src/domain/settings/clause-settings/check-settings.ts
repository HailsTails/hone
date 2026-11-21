import { defaultClauseSettings } from "./default-clause-settings.ts";
import { editionPinOf } from "./edition-pin.ts";
import type { ClauseSettingValues } from "../../../application/ports/runner-module-types.ts";
import type { ClauseSettingDeclaration, ClauseSettingDeclarations } from "../../../infrastructure/content-files/rule-sets/rule-set-reader.ts";
import type { CheckEditions } from "../../../infrastructure/hone-config-file/check-editions.ts";
import type { ClauseEditions, Edition } from "../../../infrastructure/content-files/edition.ts";
import { JSON_KIND_NAMES, jsonKindOf, sameJsonValue } from "../json-values/json-kind.ts";
import type { ReadonlyJsonValue } from "../json-values/json-value.ts";
import type { Result } from "../../result.ts";
import { listedAddressText } from "../../../infrastructure/hone-config-file/listed-address.ts";
import { type GivenCheckSettings, RENAMED_SETTINGS } from "../../../infrastructure/hone-config-file/settings-file.ts";

export type SettledCheckSettings = { readonly clauseSettings: ClauseSettingValues; readonly edition: Edition };

type SettingsRequest = {
  readonly given: GivenCheckSettings | undefined;
  readonly declarations: ClauseSettingDeclarations;
  readonly editions: ClauseEditions;
  readonly checkEditions: CheckEditions;
};

const pieceNameOf = (request: { readonly name: string }): string =>
  RENAMED_SETTINGS.find((renamed) => renamed.name === request.name)?.pieceName ?? request.name;

const fileNameOf = (request: { readonly pieceName: string }): string =>
  RENAMED_SETTINGS.find((renamed) => renamed.pieceName === request.pieceName)?.name ?? request.pieceName;

const listed = (request: { readonly values: readonly ReadonlyJsonValue[] }): string =>
  request.values.map((choice) => JSON.stringify(choice)).join(", ");

const refused = (request: { readonly given: GivenCheckSettings; readonly detail: string }): Result<never, string> => ({
  outcome: "failed",
  error: `checkSettings for ${listedAddressText({ address: request.given.address })}: ${request.detail}`,
});

const UNPINNED_EDITIONS: Readonly<Record<CheckEditions, (editions: ClauseEditions) => Edition>> = {
  pinned: (editions) => editions.default,
  latest: (editions) => editions.latest,
};

const unpinnedEditionOf = (request: { readonly editions: ClauseEditions; readonly checkEditions: CheckEditions }): Edition =>
  UNPINNED_EDITIONS[request.checkEditions](request.editions);

const editionOf = (
  request: SettingsRequest & { readonly given: GivenCheckSettings; readonly pin: ReadonlyJsonValue | undefined },
): Result<Edition, string> => {
  if (request.pin === undefined) {
    return { outcome: "ok", value: unpinnedEditionOf(request) };
  }
  const pinned = request.editions.declared.find((edition) => edition === request.pin);
  return pinned === undefined
    ? refused({ given: request.given, detail: `edition must be one of ${listed({ values: request.editions.declared })}` })
    : { outcome: "ok", value: pinned };
};

const settingRefusalOf = (request: {
  readonly name: string;
  readonly given: ReadonlyJsonValue;
  readonly declaration: ClauseSettingDeclaration | undefined;
  readonly declarations: ClauseSettingDeclarations;
}): string | undefined => {
  if (request.declaration === undefined) {
    const taken = Object.keys(request.declarations).map((pieceName) => fileNameOf({ pieceName }));
    return `its check takes no ${request.name}; it takes ${taken.join(", ")}`;
  }
  const kind = jsonKindOf({ value: request.declaration.default });
  if (jsonKindOf({ value: request.given }) !== kind) {
    return `${request.name} must be ${JSON_KIND_NAMES[kind]}, as its default is`;
  }
  const choices = request.declaration.choices;
  return choices === undefined || choices.some((choice) => sameJsonValue({ left: choice, right: request.given }) === "same")
    ? undefined
    : `${request.name} must be one of ${listed({ values: choices })}`;
};

const pieceSettingsOf = (
  request: SettingsRequest & { readonly given: GivenCheckSettings; readonly rest: ClauseSettingValues | undefined },
): Result<ClauseSettingValues, string> => {
  const defaults = defaultClauseSettings({ declarations: request.declarations });
  if (request.rest === undefined) {
    return { outcome: "ok", value: defaults };
  }
  if (Object.keys(request.declarations).length === 0) {
    return refused({ given: request.given, detail: "its check takes no settings" });
  }
  const given = Object.entries(request.rest).map(([name, setting]) => ({ name, pieceName: pieceNameOf({ name }), setting }));
  const detail = given
    .map(({ name, pieceName, setting }) =>
      settingRefusalOf({
        name,
        given: setting,
        declaration: Object.hasOwn(request.declarations, pieceName) ? request.declarations[pieceName] : undefined,
        declarations: request.declarations,
      }),
    )
    .find((refusal) => refusal !== undefined);
  return detail === undefined
    ? { outcome: "ok", value: { ...defaults, ...Object.fromEntries(given.map(({ pieceName, setting }) => [pieceName, setting])) } }
    : refused({ given: request.given, detail });
};

export const settledCheckSettings = (request: SettingsRequest): Result<SettledCheckSettings, string> => {
  const given = request.given;
  if (given === undefined) {
    return { outcome: "ok", value: { clauseSettings: defaultClauseSettings({ declarations: request.declarations }), edition: unpinnedEditionOf(request) } };
  }
  const { pin, rest } = editionPinOf({ given: given.values });
  const edition = editionOf({ ...request, given, pin });
  if (edition.outcome === "failed") {
    return edition;
  }
  const clauseSettings = pieceSettingsOf({ ...request, given, rest });
  return clauseSettings.outcome === "failed" ? clauseSettings : { outcome: "ok", value: { clauseSettings: clauseSettings.value, edition: edition.value } };
};
