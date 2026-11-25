import { checkAddressOf } from "../../language-layer/check-address.ts";
import { type ClauseChecks, readChecksOfClause } from "../../language-layer/clause-checks.ts";
import type { Check } from "../../language-layer/symptom-catalogue.ts";
import type { Result } from "../../result.ts";
import type { ClauseAddress } from "../../rule-set/clause-address-types.ts";
import { clauseAddressText, sameClauseAddress } from "../../rule-set/clause-address.ts";
import type { ClauseSettingValues } from "../../runner/runner-module-types.ts";
import { DEFAULT_CONVENTIONS } from "../../settings/conventions.ts";
import type { ListedAddress } from "../../settings/listed-address.ts";
import { reportOutputOfVersionOne } from "../../settings/report-output.ts";
import type {
  ClauseChoice,
  ConsumerSelectionFile,
} from "../../settings/selection/selection-file.ts";
import {
  type CheckState,
  eslintConfigLookupOf,
  type GivenCheckSettings,
  type ListedCheck,
  RENAMED_SETTINGS,
  type SettingsFile,
} from "../../settings/settings-file.ts";
import type { UpgradeDrop, UpgradeRefusal } from "./upgrade-refusal.ts";

export type SettingsMappingRequest = {
  readonly selection: ConsumerSelectionFile;
  readonly clauseChecks: ClauseChecks;
};

export type MappedSettings = {
  readonly settings: SettingsFile;
  readonly drops: readonly UpgradeDrop[];
};

type ClauseListing = {
  readonly clause: ClauseAddress;
  readonly listed: readonly ListedCheck[];
  readonly refusals: readonly UpgradeRefusal[];
};

const stateOf = (request: {
  readonly check: Check;
  readonly choice: ClauseChoice;
}): Result<CheckState, UpgradeRefusal> => {
  const { choice, check } = request;
  if (choice.state !== "run") {
    return { outcome: "ok", value: { state: choice.state } };
  }
  const engines = check.engines.filter((engine) => engine.name === choice.mechanism);
  const [engine, ...others] = engines;
  if (engine === undefined) {
    return {
      outcome: "failed",
      error: {
        kind: "no-engine-on-mechanism",
        check: checkAddressOf({ check }),
        mechanism: choice.mechanism,
      },
    };
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

const listedAddressOf = (request: {
  readonly clause: ClauseAddress;
  readonly check: Check;
}): ListedAddress => ({
  ruleSet: request.clause.ruleSet,
  check: checkAddressOf({ check: request.check }),
});

const listingOf = (request: {
  readonly clauseChecks: ClauseChecks;
  readonly clause: ClauseAddress;
  readonly choice: ClauseChoice;
}): ClauseListing => {
  const checks = readChecksOfClause(request);
  if (checks.length === 0) {
    return {
      clause: request.clause,
      listed: [],
      refusals: [
        { kind: "clause-without-check", clause: clauseAddressText({ address: request.clause }) },
      ],
    };
  }
  const states = checks.map((check) => ({
    check,
    state: stateOf({ check, choice: request.choice }),
  }));
  return {
    clause: request.clause,
    listed: states.flatMap(({ check, state }) =>
      state.outcome === "ok"
        ? [{ address: listedAddressOf({ clause: request.clause, check }), state: state.value }]
        : [],
    ),
    refusals: states.flatMap(({ state }) => (state.outcome === "failed" ? [state.error] : [])),
  };
};

const versionTwoNameOf = (request: { readonly setting: string }): string =>
  RENAMED_SETTINGS.find(({ pieceName }) => pieceName === request.setting)?.name ?? request.setting;

const renamedValuesOf = (request: { readonly values: ClauseSettingValues }): ClauseSettingValues =>
  Object.fromEntries(
    Object.entries(request.values).map(([setting, given]) => [
      versionTwoNameOf({ setting }),
      given,
    ]),
  );

const givenSettingsOf = (request: {
  readonly selection: ConsumerSelectionFile;
  readonly listings: readonly ClauseListing[];
}): readonly GivenCheckSettings[] =>
  request.selection.clauseSettings.flatMap(([clause, values]) =>
    (
      request.listings.find(
        (listing) => sameClauseAddress({ left: listing.clause, right: clause }) === "same",
      )?.listed ?? []
    ).map(({ address }) => ({ address, values: renamedValuesOf({ values }) })),
  );

const whyChainDropsOf = (request: {
  readonly selection: ConsumerSelectionFile;
}): readonly UpgradeDrop[] =>
  request.selection.fileExceptionWhyChains === "optional"
    ? [{ kind: "file-exception-why-chains", value: "optional" }]
    : [];

export const mappedSettings = (
  request: SettingsMappingRequest,
): Result<MappedSettings, readonly UpgradeRefusal[]> => {
  const { selection } = request;
  const listings = selection.clauses.map(([clause, choice]) =>
    listingOf({
      clauseChecks: request.clauseChecks,
      clause,
      choice,
    }),
  );
  const refusals = listings.flatMap((listing) => listing.refusals);
  if (refusals.length > 0) {
    return { outcome: "failed", error: refusals };
  }
  return {
    outcome: "ok",
    value: {
      settings: {
        exclude: selection.exclude,
        ruleSets: selection.ruleSets.map(([name, location]) => ({ name, location })),
        checks: listings.flatMap((listing) => listing.listed),
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
