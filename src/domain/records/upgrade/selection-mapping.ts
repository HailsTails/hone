import type { ClauseChecks } from "../../language-layer/clause-checks.ts";
import type { Result } from "../../result.ts";
import type { ClauseAddress } from "../../rule-set/clause-address-types.ts";
import type { ReadonlyJsonValue } from "../../settings/json-values/json-value.ts";
import type { ConsumerSelectionFile } from "../../settings/selection/selection-file.ts";
import type { SettingsFile } from "../../settings/settings-file.ts";
import { mappedSettings } from "./settings-mapping.ts";
import type { UpgradeRefusal } from "./upgrade-refusal.ts";

export type ConfinedPackages =
  | { readonly confined: "listed"; readonly packages: readonly string[] }
  | {
      readonly confined: "unreadable";
      readonly clauses: readonly ClauseAddress[];
      readonly packages: readonly string[];
    };

const CONFINED_PACKAGES = "confinedPackages";

const isPackageList = (given: ReadonlyJsonValue | undefined): given is readonly string[] =>
  Array.isArray(given) && given.every((name) => typeof name === "string" && name.length > 0);

export const mapSelectionToVersionTwo = (request: {
  readonly selection: ConsumerSelectionFile;
  readonly clauseChecks: ClauseChecks;
}): Result<SettingsFile, readonly UpgradeRefusal[]> => {
  const mapped = mappedSettings(request);
  return mapped.outcome === "failed" ? mapped : { outcome: "ok", value: mapped.value.settings };
};

export const readConfinedPackages = (request: {
  readonly selection: ConsumerSelectionFile;
}): ConfinedPackages => {
  const given = request.selection.clauseSettings.flatMap(([clause, values]) =>
    Object.hasOwn(values, CONFINED_PACKAGES) ? [{ clause, list: values[CONFINED_PACKAGES] }] : [],
  );
  const packages = given.flatMap(({ list }) => (isPackageList(list) ? list : []));
  const unreadable = given.filter(({ list }) => !isPackageList(list));
  return unreadable.length === 0
    ? { confined: "listed", packages }
    : { confined: "unreadable", clauses: unreadable.map(({ clause }) => clause), packages };
};
