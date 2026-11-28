import { gatheredOutcomes } from "../../gathered-outcomes.ts";
import type { FoundCheck } from "../../language-layer/check-address.ts";
import {
  mapAddressToSymptom,
  type RuleContent,
  type SymptomUnheld,
} from "../../language-layer/rule-content.ts";
import {
  type Check,
  mapCheckToPartyNaming,
  type Recipe,
  type SymptomAddress,
  type SymptomCatalogue,
} from "../../language-layer/symptom-catalogue.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { Result } from "../../result.ts";
import { sameOwnedName } from "../../rule-set/rule-set-identity.ts";
import type {
  AuthorisedBinding,
  Deviation,
  HoneRecord,
  OutsideParty,
  RecordReach,
} from "../hone-records/hone-record.ts";
import { banStandingOf, dependencyOf } from "./outside-dependency.ts";

export type PartyReport =
  | { readonly reported: "specifier"; readonly specifier: string }
  | { readonly reported: "not-reported" };

export type Site = {
  readonly symptom: SymptomAddress;
  readonly check: FoundCheck;
  readonly file: RepoPath;
  readonly party: PartyReport;
};

export type ResolvedSite = Site & { readonly recipes: readonly Recipe[] };

type RecipeContent = { readonly content: RuleContent<"recipes"> };

export const createResolvedSite = (
  request: RecipeContent & { readonly site: Site },
): Result<ResolvedSite, SymptomUnheld> => {
  const symptom = mapAddressToSymptom({ content: request.content, symptom: request.site.symptom });
  return symptom.outcome === "failed"
    ? symptom
    : { outcome: "ok", value: { ...request.site, recipes: symptom.value.recipes } };
};

export type Holding = "holds" | "does-not-hold";

const everyHolds = (request: { readonly holdings: readonly Holding[] }): Holding =>
  request.holdings.every((holding) => holding === "holds") ? "holds" : "does-not-hold";

const sameName = (request: { readonly left: string; readonly right: string }): Holding =>
  request.left === request.right ? "holds" : "does-not-hold";

const sameSymptom = (request: {
  readonly left: SymptomAddress;
  readonly right: SymptomAddress;
}): Holding => (sameOwnedName(request) === "same" ? "holds" : "does-not-hold");

const reachesCheck = (request: {
  readonly reach: RecordReach;
  readonly check: FoundCheck;
}): Holding => {
  const { reach, check } = request;
  switch (reach.reaches) {
    case "whole-symptom":
      return "holds";
    case "one-check":
      return check.found === "check"
        ? sameName({ left: check.check.name, right: reach.check.name })
        : "does-not-hold";
    case "unknown-check":
      return "does-not-hold";
  }
};

const reachesSymptom = (request: {
  readonly symptom: SymptomAddress;
  readonly reach: RecordReach;
  readonly site: Pick<Site, "symptom" | "check">;
}): Holding =>
  everyHolds({
    holdings: [
      sameSymptom({ left: request.symptom, right: request.site.symptom }),
      reachesCheck({ reach: request.reach, check: request.site.check }),
    ],
  });

const siteNamesAParty = (request: { readonly check: FoundCheck }): Holding =>
  request.check.found === "check" &&
  mapCheckToPartyNaming({ check: request.check.check }) === "names-the-party"
    ? "holds"
    : "does-not-hold";

const recipeAmong = (request: {
  readonly record: Deviation;
  readonly recipes: readonly Recipe[];
}): Holding =>
  request.recipes.some(
    (recipe) => sameOwnedName({ left: recipe, right: request.record.recipe }) === "same",
  )
    ? "holds"
    : "does-not-hold";

const checksOfRecipe = (
  request: RecipeContent & { readonly record: Deviation; readonly checks: readonly Check[] },
): Result<readonly Check[], SymptomUnheld> =>
  gatheredOutcomes({
    outcomes: request.checks.map((check): Result<readonly Check[], SymptomUnheld> => {
      const symptom = mapAddressToSymptom({ content: request.content, symptom: check.symptom });
      if (symptom.outcome === "failed") return symptom;
      return {
        outcome: "ok",
        value:
          recipeAmong({ record: request.record, recipes: symptom.value.recipes }) === "holds"
            ? [check]
            : [],
      };
    }),
  });

const importedPartyClearOfBans = (request: {
  readonly party: PartyReport;
  readonly catalogue: SymptomCatalogue;
}): Holding => {
  switch (request.party.reported) {
    case "not-reported":
      return "does-not-hold";
    case "specifier":
      return banStandingOf({
        namedBans: request.catalogue.namedBans,
        dependency: dependencyOf({ specifier: request.party.specifier }),
      }) === "banned"
        ? "does-not-hold"
        : "holds";
  }
};

const deviationClearOfBans = (request: {
  readonly site: Site;
  readonly catalogue: SymptomCatalogue;
}): Holding =>
  siteNamesAParty({ check: request.site.check }) === "holds"
    ? importedPartyClearOfBans({ party: request.site.party, catalogue: request.catalogue })
    : "holds";

const partyNamesSpecifier = (request: {
  readonly party: OutsideParty;
  readonly specifier: string;
}): Holding => {
  const { party, specifier } = request;
  switch (party.kind) {
    case "package":
      return sameName({ left: dependencyOf({ specifier }), right: party.dependency });
    case "scheme-module":
      return sameName({ left: specifier, right: party.specifier });
    case "scheme":
      return specifier.startsWith(party.scheme) ? "holds" : "does-not-hold";
  }
};

const bindingHolds = (request: {
  readonly binding: AuthorisedBinding;
  readonly site: Site;
}): Holding => {
  const { binding, site } = request;
  switch (binding.binds) {
    case "check-and-file":
      return "holds";
    case "check-file-and-outside-party":
      return site.party.reported === "specifier"
        ? partyNamesSpecifier({ party: binding.outsideParty, specifier: site.party.specifier })
        : "does-not-hold";
  }
};

export type ReachedPlace = { readonly check: Check; readonly file: RepoPath };

const checksReachedBy = (
  request: RecipeContent & {
    readonly record: HoneRecord;
    readonly catalogue: SymptomCatalogue;
  },
): Result<readonly Check[], SymptomUnheld> => {
  const { record, catalogue } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return {
        outcome: "ok",
        value: catalogue.checks.filter(
          (check) =>
            reachesSymptom({
              symptom: record.symptom,
              reach: record.reach,
              site: { symptom: check.symptom, check: { found: "check", check } },
            }) === "holds",
        ),
      };
    case "deviation":
      return checksOfRecipe({ content: request.content, record, checks: catalogue.checks });
    case "dependency-record":
      return { outcome: "ok", value: [] };
  }
};

const mapRecordToFile = (request: { readonly record: HoneRecord }): RepoPath | undefined => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
    case "deviation":
      return record.file;
    case "dependency-record":
      return undefined;
  }
};

export const placesReachedBy = (
  request: RecipeContent & {
    readonly record: HoneRecord;
    readonly catalogue: SymptomCatalogue;
  },
): Result<readonly ReachedPlace[], SymptomUnheld> => {
  const file = mapRecordToFile(request);
  if (file === undefined) return { outcome: "ok", value: [] };
  const checks = checksReachedBy(request);
  return checks.outcome === "failed"
    ? checks
    : { outcome: "ok", value: checks.value.map((check) => ({ check, file })) };
};

const sitedAt = (request: {
  readonly record: HoneRecord;
  readonly site: ResolvedSite;
}): Holding => {
  const { record, site } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return everyHolds({
        holdings: [
          reachesSymptom({ symptom: record.symptom, reach: record.reach, site }),
          sameName({ left: record.file, right: site.file }),
        ],
      });
    case "deviation":
      return everyHolds({
        holdings: [
          sameName({ left: record.file, right: site.file }),
          recipeAmong({ record, recipes: site.recipes }),
        ],
      });
    case "dependency-record":
      return "does-not-hold";
  }
};

const partyHolds = (request: {
  readonly record: HoneRecord;
  readonly site: Site;
  readonly catalogue: SymptomCatalogue;
}): Holding => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "dependency-record":
      return "holds";
    case "authorised-location":
      return bindingHolds({ binding: record.holding.binding, site: request.site });
    case "deviation":
      return deviationClearOfBans(request);
  }
};

export const holdsAt = (request: {
  readonly record: HoneRecord;
  readonly site: ResolvedSite;
  readonly catalogue: SymptomCatalogue;
}): Holding => everyHolds({ holdings: [sitedAt(request), partyHolds(request)] });
