import { checkAddressOf, checkAt, checksOf } from "../language-layer/check-address.ts";
import type {
  CataloguedClause,
  Check,
  ClauseSight,
  SymptomCatalogue,
} from "../language-layer/symptom-catalogue.ts";
import type { Result } from "../result.ts";
import type { ClauseAddress } from "../rule-set/clause-address-types.ts";
import { sameClauseAddress, TOOL_RULE_SET } from "../rule-set/clause-address.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import { everyOk } from "./every-ok.ts";
import { sameJsonValue } from "./json-values/json-kind.ts";
import { type ListedAddress, listedAddressText, sameListedAddress } from "./listed-address.ts";
import type { CheckState, GivenCheckSettings, ListedCheck } from "./settings-file.ts";

export type RuleSetCatalogue = {
  readonly ruleSet: ClauseAddress["ruleSet"];
  readonly catalogue: SymptomCatalogue;
};

export type ClauseChoice =
  | {
      readonly state: "run";
      readonly mechanism: EngineId;
      readonly settings: GivenCheckSettings | undefined;
    }
  | { readonly state: "not-run" }
  | { readonly state: "not-adopted" };

export type ChosenClause = {
  readonly clause: ClauseAddress;
  readonly checks: readonly ListedAddress[];
  readonly choice: ClauseChoice;
};

export type CheckChoices = {
  readonly clauses: readonly ChosenClause[];
  readonly available: readonly Check[];
};

export type CheckSettingsListing = "unlisted" | "not-run" | "not-adopted";

export type CheckChoiceRefusal =
  | { readonly kind: "unknown-check"; readonly address: string }
  | { readonly kind: "review-only-listed"; readonly address: string }
  | {
      readonly kind: "engine-not-allowed";
      readonly address: string;
      readonly engine: string;
      readonly engines: readonly string[];
    }
  | {
      readonly kind: "duplicate-check";
      readonly key: "checks" | "checkSettings";
      readonly address: string;
      readonly prefixedAddress: string;
    }
  | {
      readonly kind: "checks-run-together";
      readonly address: string;
      readonly others: readonly string[];
    }
  | {
      readonly kind: "check-settings-refused";
      readonly address: string;
      readonly listing: CheckSettingsListing;
    }
  | { readonly kind: "check-settings-differ"; readonly address: string; readonly other: string };

type FoundCheck = { readonly check: Check; readonly catalogue: SymptomCatalogue };

type ResolvedCheck = FoundCheck & { readonly listed: ListedCheck; readonly choice: ClauseChoice };

type CatalogueRequest = { readonly catalogues: readonly RuleSetCatalogue[] };

export const sameRuleSet = (request: {
  readonly left: ClauseAddress["ruleSet"];
  readonly right: ClauseAddress["ruleSet"];
}): "same" | "different" =>
  (request.left === TOOL_RULE_SET ? TOOL_RULE_SET : request.left.name) ===
  (request.right === TOOL_RULE_SET ? TOOL_RULE_SET : request.right.name)
    ? "same"
    : "different";

export const catalogueOf = (
  request: CatalogueRequest & { readonly ruleSet: ClauseAddress["ruleSet"] },
): SymptomCatalogue | undefined =>
  request.catalogues.find(
    (held) => sameRuleSet({ left: held.ruleSet, right: request.ruleSet }) === "same",
  )?.catalogue;

const seenSymptomNames = (request: { readonly sight: ClauseSight }): readonly string[] => {
  switch (request.sight.kind) {
    case "one-symptom":
      return [request.sight.symptom.name];
    case "symptom-by-form":
      return request.sight.forms.map((form) => form.symptom.name);
    case "method":
      return request.sight.outcomeSeenBy.map((symptom) => symptom.name);
    case "outside-the-cases":
      return [];
  }
};

const listingOfClause = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly entry: CataloguedClause;
  readonly check: string;
}): "review-only" | "other" =>
  checksOf({ catalogue: request.catalogue, clause: request.entry.clause }).length === 0 &&
  seenSymptomNames({ sight: request.entry.sight }).some(
    (symptom) => `${symptom}#${request.entry.clause.clause}` === request.check,
  )
    ? "review-only"
    : "other";

const checkOf = (
  request: CatalogueRequest & { readonly address: ListedAddress },
): Result<FoundCheck, CheckChoiceRefusal> => {
  const address = listedAddressText({ address: request.address });
  const catalogue = catalogueOf({
    catalogues: request.catalogues,
    ruleSet: request.address.ruleSet,
  });
  if (catalogue === undefined) {
    return { outcome: "failed", error: { kind: "unknown-check", address } };
  }
  const found = checkAt({ catalogue, address: request.address.check });
  if (found.found === "check") {
    return { outcome: "ok", value: { check: found.check, catalogue } };
  }
  return catalogue.clauses.some(
    (entry) =>
      listingOfClause({ catalogue, entry, check: request.address.check }) === "review-only",
  )
    ? { outcome: "failed", error: { kind: "review-only-listed", address } }
    : { outcome: "failed", error: { kind: "unknown-check", address } };
};

const choiceOf = (request: {
  readonly listed: ListedCheck;
  readonly check: Check;
}): Result<ClauseChoice, CheckChoiceRefusal> => {
  const state = request.listed.state;
  if (state.state !== "run") {
    return { outcome: "ok", value: { state: state.state } };
  }
  const engine = request.check.engines.find((candidate) => candidate.name === state.engine);
  return engine === undefined
    ? {
        outcome: "failed",
        error: {
          kind: "engine-not-allowed",
          address: listedAddressText({ address: request.listed.address }),
          engine: state.engine,
          engines: request.check.engines.map((candidate) => candidate.name),
        },
      }
    : { outcome: "ok", value: { state: "run", mechanism: engine.name, settings: undefined } };
};

const resolvedCheckOf = (
  request: CatalogueRequest & { readonly listed: ListedCheck },
): Result<ResolvedCheck, CheckChoiceRefusal> => {
  const found = checkOf({ catalogues: request.catalogues, address: request.listed.address });
  if (found.outcome === "failed") {
    return found;
  }
  const choice = choiceOf({ listed: request.listed, check: found.value.check });
  return choice.outcome === "failed"
    ? choice
    : { outcome: "ok", value: { ...found.value, listed: request.listed, choice: choice.value } };
};

const duplicateRefusalOf = (request: {
  readonly key: "checks" | "checkSettings";
  readonly addresses: readonly ListedAddress[];
}): CheckChoiceRefusal | undefined => {
  const repeated = request.addresses.find((address, index) =>
    request.addresses
      .slice(0, index)
      .some((earlier) => sameListedAddress({ left: earlier, right: address }) === "same"),
  );
  if (repeated === undefined) {
    return undefined;
  }
  const address = listedAddressText({ address: repeated });
  return {
    kind: "duplicate-check",
    key: request.key,
    address,
    prefixedAddress: repeated.ruleSet === TOOL_RULE_SET ? `${TOOL_RULE_SET}/${address}` : address,
  };
};

const sameState = (request: {
  readonly left: CheckState;
  readonly right: CheckState;
}): "same" | "different" =>
  request.left.state === request.right.state &&
  (request.left.state !== "run" ||
    request.right.state !== "run" ||
    request.left.engine === request.right.engine)
    ? "same"
    : "different";

const checkTextOf = (request: {
  readonly ruleSet: ClauseAddress["ruleSet"];
  readonly check: Check;
}): string =>
  listedAddressText({
    address: { ruleSet: request.ruleSet, check: checkAddressOf({ check: request.check }) },
  });

const runTogetherRefusalOf = (request: {
  readonly resolved: readonly ResolvedCheck[];
}): CheckChoiceRefusal | undefined =>
  request.resolved
    .map((listed): CheckChoiceRefusal | undefined => {
      const ruleSet = listed.listed.address.ruleSet;
      const others = checksOf({ catalogue: listed.catalogue, clause: listed.check.clause })
        .filter((other) => other !== listed.check)
        .filter(
          (other) =>
            !request.resolved.some(
              (candidate) =>
                candidate.check === other &&
                sameState({ left: candidate.listed.state, right: listed.listed.state }) === "same",
            ),
        )
        .map((other) => checkTextOf({ ruleSet, check: other }));
      return others.length === 0
        ? undefined
        : {
            kind: "checks-run-together",
            address: listedAddressText({ address: listed.listed.address }),
            others,
          };
    })
    .find((refusal) => refusal !== undefined);

const chosenClausesOf = (request: {
  readonly resolved: readonly ResolvedCheck[];
}): readonly ChosenClause[] =>
  request.resolved
    .filter(
      (resolved, index) =>
        request.resolved.findIndex(
          (earlier) =>
            sameClauseAddress({ left: earlier.check.clause, right: resolved.check.clause }) ===
            "same",
        ) === index,
    )
    .map((first) => ({
      clause: first.check.clause,
      checks: request.resolved
        .filter(
          (resolved) =>
            sameClauseAddress({ left: resolved.check.clause, right: first.check.clause }) ===
            "same",
        )
        .map((resolved) => resolved.listed.address),
      choice: first.choice,
    }));

type SettledSettings = { readonly given: GivenCheckSettings; readonly clause: ClauseAddress };

const settingsOnRunCheck = (
  request: CatalogueRequest & {
    readonly given: GivenCheckSettings;
    readonly clauses: readonly ChosenClause[];
  },
): Result<SettledSettings, CheckChoiceRefusal> => {
  const found = checkOf({ catalogues: request.catalogues, address: request.given.address });
  if (found.outcome === "failed") {
    return found;
  }
  const address = listedAddressText({ address: request.given.address });
  const chosen = request.clauses.find(
    (clause) =>
      sameClauseAddress({ left: clause.clause, right: found.value.check.clause }) === "same",
  );
  if (chosen === undefined) {
    return {
      outcome: "failed",
      error: { kind: "check-settings-refused", address, listing: "unlisted" },
    };
  }
  if (chosen.choice.state !== "run") {
    return {
      outcome: "failed",
      error: { kind: "check-settings-refused", address, listing: chosen.choice.state },
    };
  }
  return { outcome: "ok", value: { given: request.given, clause: chosen.clause } };
};

const differingSettingsRefusalOf = (request: {
  readonly settled: readonly SettledSettings[];
}): CheckChoiceRefusal | undefined => {
  const pairs = request.settled.flatMap((later, index) =>
    request.settled
      .slice(0, index)
      .filter(
        (earlier) => sameClauseAddress({ left: earlier.clause, right: later.clause }) === "same",
      )
      .filter(
        (earlier) =>
          sameJsonValue({ left: earlier.given.values, right: later.given.values }) === "different",
      )
      .map((earlier): CheckChoiceRefusal => ({
        kind: "check-settings-differ",
        address: listedAddressText({ address: later.given.address }),
        other: listedAddressText({ address: earlier.given.address }),
      })),
  );
  return pairs[0];
};

const withSettings = (request: {
  readonly clause: ChosenClause;
  readonly settled: readonly SettledSettings[];
}): ChosenClause => {
  const given = request.settled.find(
    (settled) =>
      sameClauseAddress({ left: settled.clause, right: request.clause.clause }) === "same",
  )?.given;
  return request.clause.choice.state === "run" && given !== undefined
    ? { ...request.clause, choice: { ...request.clause.choice, settings: given } }
    : request.clause;
};

const availableOf = (
  request: CatalogueRequest & { readonly checks: readonly Check[] },
): readonly Check[] => {
  const symptoms = new Set(request.checks.map((check) => check.symptom.name));
  const listed = new Set(request.checks);
  return request.catalogues.flatMap((held) =>
    held.catalogue.checks.filter((check) => symptoms.has(check.symptom.name) && !listed.has(check)),
  );
};

const failedWith = (
  refusal: CheckChoiceRefusal,
): { readonly outcome: "failed"; readonly error: CheckChoiceRefusal } => ({
  outcome: "failed",
  error: refusal,
});

export const checkChoicesOf = (
  request: CatalogueRequest & {
    readonly checks: readonly ListedCheck[];
    readonly checkSettings: readonly GivenCheckSettings[];
  },
): Result<CheckChoices, CheckChoiceRefusal> => {
  const duplicate =
    duplicateRefusalOf({
      key: "checks",
      addresses: request.checks.map((listed) => listed.address),
    }) ??
    duplicateRefusalOf({
      key: "checkSettings",
      addresses: request.checkSettings.map((given) => given.address),
    });
  if (duplicate !== undefined) {
    return failedWith(duplicate);
  }
  const resolved = everyOk({
    entries: request.checks,
    resolve: (listed) => resolvedCheckOf({ catalogues: request.catalogues, listed }),
  });
  if (resolved.outcome === "failed") {
    return resolved;
  }
  const together = runTogetherRefusalOf({ resolved: resolved.value });
  if (together !== undefined) {
    return failedWith(together);
  }
  const clauses = chosenClausesOf({ resolved: resolved.value });
  const settled = everyOk({
    entries: request.checkSettings,
    resolve: (given) => settingsOnRunCheck({ catalogues: request.catalogues, given, clauses }),
  });
  if (settled.outcome === "failed") {
    return settled;
  }
  const differing = differingSettingsRefusalOf({ settled: settled.value });
  if (differing !== undefined) {
    return failedWith(differing);
  }
  return {
    outcome: "ok",
    value: {
      clauses: clauses.map((clause) => withSettings({ clause, settled: settled.value })),
      available: availableOf({
        catalogues: request.catalogues,
        checks: resolved.value.map((each) => each.check),
      }),
    },
  };
};
