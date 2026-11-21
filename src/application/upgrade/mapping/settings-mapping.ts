import { reportOutputOfVersionOne } from "../../../infrastructure/hone-config-file/report-output.ts";
import type { ClauseSettingValues } from "../../../domain/runner/runner-module-types.ts";
import { type RuleSetCatalogue, sameRuleSet, uncoveredOf } from "../../../domain/settings/check-choices.ts";
import { DEFAULT_CONVENTIONS } from "../../../infrastructure/hone-config-file/conventions.ts";
import type { ListedAddress } from "../../../infrastructure/hone-config-file/listed-address.ts";
import {
  type CheckState,
  eslintConfigLookupOf,
  type GivenCheckSettings,
  type ListedCheck,
  RENAMED_SETTINGS,
  type SettingsFile,
} from "../../../infrastructure/hone-config-file/settings-file.ts";
import { checkAddressOf } from "../../../domain/language-layer/check-address.ts";
import type { Check } from "../../../domain/language-layer/symptom-catalogue.ts";
import { type ClauseAddress, clauseAddressText, sameClauseAddress } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { Result } from "../../../domain/result.ts";
import type { ClauseChoice, ConsumerSelectionFile } from "../../../infrastructure/disciplines-file/selection-file.ts";
import { checksOfClause } from "../../../domain/language-layer/clause-checks.ts";
import type { UpgradeDrop, UpgradeRefusal } from "./upgrade-refusal.ts";

export type SettingsMappingRequest = {
  readonly selection: ConsumerSelectionFile;
  readonly catalogues: readonly RuleSetCatalogue[];
};

export type MarkedNotAdopted = {
  readonly check: ListedAddress;
  readonly clause: ClauseAddress;
  readonly reason: "discipline-not-selected";
};

export type MappedSettings = {
  readonly settings: SettingsFile;
  readonly drops: readonly UpgradeDrop[];
  readonly markedNotAdopted: readonly MarkedNotAdopted[];
};

type ClauseListing = {
  readonly clause: ClauseAddress;
  readonly checks: readonly Check[];
  readonly listed: readonly ListedCheck[];
  readonly refusals: readonly UpgradeRefusal[];
};

const stateOf = (request: { readonly check: Check; readonly choice: ClauseChoice }): Result<CheckState, UpgradeRefusal> => {
  const { choice, check } = request;
  if (choice.state !== "run") {
    return { outcome: "ok", value: { state: choice.state } };
  }
  const engines = check.engines.filter((engine) => engine.mechanism === choice.mechanism);
  const [engine, ...others] = engines;
  if (engine === undefined) {
    return { outcome: "failed", error: { kind: "no-engine-on-mechanism", check: checkAddressOf({ check }), mechanism: choice.mechanism } };
  }
  return others.length === 0
    ? { outcome: "ok", value: { state: "run", engine: engine.name } }
    : {
        outcome: "failed",
        error: {
          kind: "two-engines-on-mechanism",
          check: checkAddressOf({ check }),
          mechanism: choice.mechanism,
          engines: engines.map(({ name }) => name),
        },
      };
};

const listedAddressOf = (request: { readonly clause: ClauseAddress; readonly check: Check }): ListedAddress => ({
  ruleSet: request.clause.ruleSet,
  check: checkAddressOf({ check: request.check }),
});

const listingOf = (request: {
  readonly catalogues: readonly RuleSetCatalogue[];
  readonly clause: ClauseAddress;
  readonly choice: ClauseChoice;
}): ClauseListing => {
  const checks = checksOfClause(request);
  if (checks.length === 0) {
    return {
      clause: request.clause,
      checks: [],
      listed: [],
      refusals: [{ kind: "clause-without-check", clause: clauseAddressText({ address: request.clause }) }],
    };
  }
  const states = checks.map((check) => ({ check, state: stateOf({ check, choice: request.choice }) }));
  return {
    clause: request.clause,
    checks: states.flatMap(({ check, state }) => (state.outcome === "ok" ? [check] : [])),
    listed: states.flatMap(({ check, state }) =>
      state.outcome === "ok" ? [{ address: listedAddressOf({ clause: request.clause, check }), state: state.value }] : [],
    ),
    refusals: states.flatMap(({ state }) => (state.outcome === "failed" ? [state.error] : [])),
  };
};

const versionTwoNameOf = (request: { readonly setting: string }): string =>
  RENAMED_SETTINGS.find(({ pieceName }) => pieceName === request.setting)?.name ?? request.setting;

const renamedValuesOf = (request: { readonly values: ClauseSettingValues }): ClauseSettingValues =>
  Object.fromEntries(Object.entries(request.values).map(([setting, given]) => [versionTwoNameOf({ setting }), given]));

const givenSettingsOf = (request: {
  readonly selection: ConsumerSelectionFile;
  readonly listings: readonly ClauseListing[];
}): readonly GivenCheckSettings[] =>
  request.selection.clauseSettings.flatMap(([clause, values]) =>
    (request.listings.find((listing) => sameClauseAddress({ left: listing.clause, right: clause }) === "same")?.listed ?? []).map(
      ({ address }) => ({ address, values: renamedValuesOf({ values }) }),
    ),
  );

const whyChainDropsOf = (request: { readonly selection: ConsumerSelectionFile }): readonly UpgradeDrop[] =>
  request.selection.fileExceptionWhyChains === "optional" ? [{ kind: "file-exception-why-chains", value: "optional" }] : [];

const sameDiscipline = (request: { readonly left: ClauseAddress; readonly right: ClauseAddress }): "same" | "different" =>
  sameRuleSet({ left: request.left.ruleSet, right: request.right.ruleSet }) === "same" && request.left.discipline === request.right.discipline
    ? "same"
    : "different";

const unselectedUncoveredOf = (request: SettingsMappingRequest & { readonly listings: readonly ClauseListing[] }): readonly ClauseAddress[] =>
  uncoveredOf({ catalogues: request.catalogues, checks: request.listings.flatMap((listing) => listing.checks) }).filter(
    (clause) => !request.selection.clauses.some(([selected]) => sameDiscipline({ left: selected, right: clause }) === "same"),
  );

const NOT_ADOPTED: ClauseChoice = { state: "not-adopted" };

const markedListingsOf = (request: SettingsMappingRequest & { readonly listings: readonly ClauseListing[] }): readonly ClauseListing[] => {
  const clauses = unselectedUncoveredOf(request);
  if (clauses.length === 0) {
    return [];
  }
  const marked = clauses.map((clause) => listingOf({ catalogues: request.catalogues, clause, choice: NOT_ADOPTED }));
  return [...marked, ...markedListingsOf({ ...request, listings: [...request.listings, ...marked] })];
};

const markedNotAdoptedOf = (request: { readonly marked: readonly ClauseListing[] }): readonly MarkedNotAdopted[] =>
  request.marked.flatMap((listing) =>
    listing.listed.map(({ address }): MarkedNotAdopted => ({ check: address, clause: listing.clause, reason: "discipline-not-selected" })),
  );

export const mappedSettings = (request: SettingsMappingRequest): Result<MappedSettings, readonly UpgradeRefusal[]> => {
  const { selection } = request;
  const listings = selection.clauses.map(([clause, choice]) => listingOf({ catalogues: request.catalogues, clause, choice }));
  const refusals = listings.flatMap((listing) => listing.refusals);
  if (refusals.length > 0) {
    return { outcome: "failed", error: refusals };
  }
  const marked = markedListingsOf({ ...request, listings });
  return {
    outcome: "ok",
    value: {
      markedNotAdopted: markedNotAdoptedOf({ marked }),
      settings: {
        exclude: selection.exclude,
        ruleSets: selection.ruleSets.map(([name, location]) => ({ name, location })),
        checks: [...listings, ...marked].flatMap((listing) => listing.listed),
        checkSettings: givenSettingsOf({ selection, listings }),
        forfeiture: selection.assessment.forfeiture,
        reportOutput: reportOutputOfVersionOne({ output: selection.reportOutput }),
        checkEditions: selection.checkEditions,
        eslintConfigLookup: eslintConfigLookupOf({ declared: selection.eslintConfigLookup }),
        eslintConfigRoots: selection.eslintConfigRoots,
        conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
      },
      drops: whyChainDropsOf({ selection }),
    },
  };
};
