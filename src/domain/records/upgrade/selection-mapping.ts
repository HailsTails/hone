import type { ClauseChecks } from "../../language-layer/clause-checks.ts";
import type { Result } from "../../result.ts";
import type { ClauseAddress } from "../../rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../rule-set/clause-address.ts";
import type { ReadonlyJsonValue } from "../../settings/json-values/json-value.ts";
import type { ConsumerSelectionFile } from "../../settings/selection/selection-file.ts";
import type { SettingsFile } from "../../settings/settings-file.ts";
import { mappedSettings } from "./settings-mapping.ts";
import type { UpgradeRefusal } from "./upgrade-refusal.ts";

export type ConfinedPackages =
  | { readonly confined: "listed"; readonly packages: readonly string[] }
  | { readonly confined: "unreadable"; readonly detail: string };

const CONFINED_PACKAGES = "confinedPackages";

const isPackageList = (given: ReadonlyJsonValue | undefined): given is readonly string[] =>
  Array.isArray(given) && given.every((name) => typeof name === "string" && name.length > 0);

export const mapSelectionToVersionTwo = (request: {
  readonly selection: ConsumerSelectionFile;
  readonly clauseChecks: ClauseChecks;
  readonly notAdoptedClauses: readonly ClauseAddress[];
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
  const unreadable = given.find(({ list }) => !isPackageList(list));
  return unreadable === undefined
    ? {
        confined: "listed",
        packages: given.flatMap(({ list }) => (isPackageList(list) ? list : [])),
      }
    : {
        confined: "unreadable",
        detail: `${CONFINED_PACKAGES} for ${clauseAddressText({ address: unreadable.clause })} is not a list of package names`,
      };
};
