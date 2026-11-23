import type { FoundCheck } from "../../language-layer/check-address.ts";
import type { Check, Symptom, SymptomCatalogue } from "../../language-layer/symptom-catalogue.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { sameOwnedName } from "../../rule-set/rule-set-identity.ts";
import type {
  AuthorisedReach,
  BoundaryRecord,
  Deviation,
  HoneRecord,
  OutsideParty,
  RuntimeFacility,
} from "../hone-records/hone-record.ts";
import { banStandingOf, dependencyOf } from "./outside-dependency.ts";

export type PartyReport =
  | { readonly reported: "specifier"; readonly specifier: string }
  | { readonly reported: "not-reported" };

export type Site = {
  readonly symptom: Symptom;
  readonly check: FoundCheck;
  readonly file: RepoPath;
  readonly party: PartyReport;
};

export type Holding = "holds" | "does-not-hold";

const FOLDER_SEPARATOR = "/";

export const IMPORTED_PARTY_SYMPTOMS: readonly string[] = [
  "outside-import-past-a-boundary",
  "library-class-built-in-place",
  "outside-type-in-a-signature",
];

export const RUNTIME_REACH: Readonly<Record<RuntimeFacility, readonly string[]>> = {
  clock: ["date-used-directly"],
  random: ["ambient-randomness"],
  process: ["process-global-used-in-place"],
  json: ["text-past-its-reader"],
};

const everyHolds = (request: { readonly holdings: readonly Holding[] }): Holding =>
  request.holdings.every((holding) => holding === "holds") ? "holds" : "does-not-hold";

const sameName = (request: { readonly left: string; readonly right: string }): Holding =>
  request.left === request.right ? "holds" : "does-not-hold";

const namedIn = (request: { readonly name: string; readonly names: readonly string[] }): Holding =>
  request.names.includes(request.name) ? "holds" : "does-not-hold";

const toolSymptomNamedIn = (request: {
  readonly symptom: Symptom;
  readonly names: readonly string[];
}): Holding =>
  request.symptom.ruleSet === TOOL_RULE_SET
    ? namedIn({ name: request.symptom.name, names: request.names })
    : "does-not-hold";

const sameSymptom = (request: { readonly left: Symptom; readonly right: Symptom }): Holding =>
  sameOwnedName(request) === "same" ? "holds" : "does-not-hold";

const reachesCheck = (request: {
  readonly reach: AuthorisedReach;
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
  readonly symptom: Symptom;
  readonly reach: AuthorisedReach;
  readonly site: Pick<Site, "symptom" | "check">;
}): Holding =>
  everyHolds({
    holdings: [
      sameSymptom({ left: request.symptom, right: request.site.symptom }),
      reachesCheck({ reach: request.reach, check: request.site.check }),
    ],
  });

const clearOfOutsideParties = (request: { readonly symptom: Symptom }): Holding =>
  toolSymptomNamedIn({ symptom: request.symptom, names: IMPORTED_PARTY_SYMPTOMS }) === "holds"
    ? "does-not-hold"
    : "holds";

export const reachOf = (request: { readonly party: OutsideParty }): readonly string[] => {
  switch (request.party.kind) {
    case "package":
    case "scheme-module":
      return IMPORTED_PARTY_SYMPTOMS;
    case "runtime":
      return RUNTIME_REACH[request.party.facility];
  }
};

const moduleCovers = (request: { readonly module: RepoPath; readonly file: RepoPath }): Holding =>
  request.file === request.module || request.file.startsWith(`${request.module}${FOLDER_SEPARATOR}`)
    ? "holds"
    : "does-not-hold";

const recipeOfSymptom = (request: {
  readonly record: Deviation;
  readonly symptom: Symptom;
}): Holding =>
  request.symptom.recipes.some(
    (recipe) => sameOwnedName({ left: recipe, right: request.record.recipe }) === "same",
  )
    ? "holds"
    : "does-not-hold";

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
  clearOfOutsideParties({ symptom: request.site.symptom }) === "holds"
    ? "holds"
    : importedPartyClearOfBans({ party: request.site.party, catalogue: request.catalogue });

const reportedPartyIs = (request: {
  readonly party: OutsideParty;
  readonly specifier: string;
}): Holding => {
  switch (request.party.kind) {
    case "package":
      return sameName({
        left: dependencyOf({ specifier: request.specifier }),
        right: request.party.dependency,
      });
    case "scheme-module":
      return sameName({ left: request.specifier, right: request.party.specifier });
    case "runtime":
      return "does-not-hold";
  }
};

const boundaryPartyNamed = (request: {
  readonly record: BoundaryRecord;
  readonly site: Site;
}): Holding => {
  if (request.record.outsideParty.kind === "runtime") {
    return "holds";
  }
  switch (request.site.party.reported) {
    case "not-reported":
      return "does-not-hold";
    case "specifier":
      return reportedPartyIs({
        party: request.record.outsideParty,
        specifier: request.site.party.specifier,
      });
  }
};

export type RecordPlace =
  | { readonly at: "file"; readonly file: RepoPath }
  | { readonly at: "module"; readonly module: RepoPath };

export type ReachedPlace = { readonly check: Check; readonly place: RecordPlace };

const checksReachedBy = (request: {
  readonly record: HoneRecord;
  readonly catalogue: SymptomCatalogue;
}): readonly Check[] => {
  const { record, catalogue } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return catalogue.checks.filter(
        (check) =>
          reachesSymptom({
            symptom: record.symptom,
            reach: record.reach,
            site: { symptom: check.symptom, check: { found: "check", check } },
          }) === "holds",
      );
    case "deviation":
      return catalogue.checks.filter(
        (check) => recipeOfSymptom({ record, symptom: check.symptom }) === "holds",
      );
    case "boundary-record":
      return catalogue.checks.filter(
        (check) =>
          toolSymptomNamedIn({
            symptom: check.symptom,
            names: reachOf({ party: record.outsideParty }),
          }) === "holds",
      );
    case "dependency-record":
      return [];
  }
};

const placeOf = (request: { readonly record: HoneRecord }): RecordPlace | undefined => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
    case "deviation":
      return { at: "file", file: record.file };
    case "boundary-record":
      return { at: "module", module: record.module };
    case "dependency-record":
      return undefined;
  }
};

export const placesReachedBy = (request: {
  readonly record: HoneRecord;
  readonly catalogue: SymptomCatalogue;
}): readonly ReachedPlace[] => {
  const place = placeOf(request);
  return place === undefined ? [] : checksReachedBy(request).map((check) => ({ check, place }));
};

const sitedAt = (request: { readonly record: HoneRecord; readonly site: Site }): Holding => {
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
          recipeOfSymptom({ record, symptom: site.symptom }),
        ],
      });
    case "boundary-record":
      return everyHolds({
        holdings: [
          moduleCovers({ module: record.module, file: site.file }),
          toolSymptomNamedIn({
            symptom: site.symptom,
            names: reachOf({ party: record.outsideParty }),
          }),
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
    case "authorised-location":
    case "dependency-record":
      return "holds";
    case "deviation":
      return deviationClearOfBans(request);
    case "boundary-record":
      return boundaryPartyNamed({ record, site: request.site });
  }
};

export const holdsAt = (request: {
  readonly record: HoneRecord;
  readonly site: Site;
  readonly catalogue: SymptomCatalogue;
}): Holding =>
  everyHolds({
    holdings: [sitedAt({ record: request.record, site: request.site }), partyHolds(request)],
  });
