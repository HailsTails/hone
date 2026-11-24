import type { z } from "zod";

import {
  mapCheckToAddress,
  mapSymptomToAddress,
} from "../../../domain/language-layer/catalogue-address.ts";
import {
  type Binding,
  type Case,
  type Check,
  mapSymptomToAuthorisation,
  type NamedBan,
  pointedNameOf,
  type Recipe,
  type Symptom,
  type SymptomAddress,
  type SymptomCatalogue,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import { banStandingOf } from "../../../domain/records/answering/outside-dependency.ts";
import type {
  AuthorisedBinding,
  AuthorisedLocation,
  AuthorisedReach,
  Debt,
  DependencyRecord,
  Deviation,
  HeldAs,
  HoneRecord,
  OutsideParty,
  Owing,
  StatedOutsideParty,
  RecordRefusal,
  RecordsAtBase,
  SymptomReach,
  RecordReach,
} from "../../../domain/records/hone-records/hone-record.ts";
import type { NamedFolderKind } from "../../../domain/records/hone-records/named-folder-kind.ts";
import type { RecordedReach } from "../../../domain/records/hone-records/recorded-reach.ts";
import {
  namedRecordsFileOf,
  type SingleFileKind,
} from "../../../domain/records/hone-records/records-layout.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RuleSetIdentity } from "../../../domain/rule-set/clause-address-types.ts";
import { ownedNameText, sameOwnedName } from "../../../domain/rule-set/rule-set-identity.ts";
import type { ReadonlyJsonValue } from "../../../domain/settings/json-values/json-value.ts";
import {
  carriedAuthorisedLocationWireSchema,
  carriedFormSchema,
  debtWireSchema,
  dependencyRecordWireSchema,
  deviationWireSchema,
  statedAuthorisedLocationWireSchema,
} from "../records-wire.ts";
import { carriedStandingOf } from "./carried-standing.ts";
import { mapZodIssuesToRecordIssues } from "./record-issues.ts";

type Resolution<Value> = Result<Value, readonly RecordRefusal[]>;

type RecordedSymptom = { readonly symptom: Symptom; readonly reach: RecordReach };

type AuthorisedSymptom = { readonly symptom: Symptom; readonly reach: AuthorisedReach };

type DebtSymptom = { readonly symptom: SymptomAddress; readonly reach: SymptomReach };

export type RecordLookups = Pick<
  SymptomCatalogue,
  "symptoms" | "checks" | "recipes" | "cases" | "namedBans"
>;

export type Resolving = RecordLookups & {
  readonly base: RecordsAtBase;
  readonly file: RepoPath;
  readonly entry: ReadonlyJsonValue;
};

export type FiledUnder =
  | { readonly kind: NamedFolderKind; readonly ruleSet: RuleSetIdentity }
  | { readonly kind: SingleFileKind };

const SCHEME_SEPARATOR = ":";

const resolved = <Value>(found: Value): Resolution<Value> => ({ outcome: "ok", value: found });

const refusedWith = (refusal: RecordRefusal): Resolution<never> => ({
  outcome: "failed",
  error: [refusal],
});

const refusalsOf = (resolution: Resolution<unknown>): readonly RecordRefusal[] =>
  resolution.outcome === "failed" ? resolution.error : [];

const formOf = <Output>(request: {
  readonly schema: z.ZodType<Output>;
  readonly entry: ReadonlyJsonValue;
}): Resolution<Output> => {
  const parsed = request.schema.safeParse(request.entry);
  return parsed.success
    ? resolved(parsed.data)
    : refusedWith({
        kind: "form-refused",
        issues: mapZodIssuesToRecordIssues({ issues: parsed.error.issues }),
      });
};

const carriedForm = (request: { readonly entry: ReadonlyJsonValue }): HeldAs =>
  carriedFormSchema.safeParse(request.entry).success ? "carried" : "stated";

const symptomNamed = (request: {
  readonly symptoms: readonly Symptom[];
  readonly ruleSet: RuleSetIdentity;
  readonly name: string;
}): Resolution<Symptom> => {
  const symptom = request.symptoms.find(
    (candidate) => sameOwnedName({ left: candidate, right: request }) === "same",
  );
  return symptom === undefined
    ? refusedWith({ kind: "unknown-symptom", symptom: request.name })
    : resolved(symptom);
};

const recipeNamed = (request: {
  readonly recipes: readonly Recipe[];
  readonly ruleSet: RuleSetIdentity;
  readonly name: string;
}): Resolution<Recipe> => {
  const recipe = request.recipes.find(
    (candidate) => sameOwnedName({ left: candidate, right: request }) === "same",
  );
  return recipe === undefined
    ? refusedWith({ kind: "unknown-recipe", recipe: ownedNameText(request) })
    : resolved(recipe);
};

const owedWithin = (request: { readonly case: Case; readonly owes: string }): Owing => {
  const point = request.case.owes.find(
    (candidate) => pointedNameOf({ point: candidate }) === request.owes,
  );
  return point === undefined
    ? {
        matches: "not-the-catalogue",
        note: { kind: "owes-not-owed", case: request.case, owes: request.owes },
      }
    : { matches: "the-catalogue", case: request.case, owes: point };
};

export const owedBy = (request: {
  readonly cases: readonly Case[];
  readonly case: string;
  readonly owes: string;
}): Owing => {
  const found = request.cases.find((candidate) => candidate.name === request.case);
  return found === undefined
    ? {
        matches: "not-the-catalogue",
        note: { kind: "unknown-case", case: request.case, owes: request.owes },
      }
    : owedWithin({ case: found, owes: request.owes });
};

const placedIn = (request: {
  readonly file: RepoPath;
  readonly ruleSet: RuleSetIdentity;
  readonly kind: NamedFolderKind;
  readonly name: string;
}): Resolution<RepoPath> => {
  const belongsIn = namedRecordsFileOf(request);
  if (belongsIn.outcome === "failed") {
    return refusedWith(belongsIn.error);
  }
  return request.file === belongsIn.value
    ? resolved(request.file)
    : refusedWith({ kind: "misplaced", belongsIn: belongsIn.value });
};

const notBanned = (request: {
  readonly namedBans: readonly NamedBan[];
  readonly dependency: string;
}): Resolution<string> =>
  banStandingOf({ namedBans: request.namedBans, dependency: request.dependency }) === "banned"
    ? refusedWith({ kind: "named-ban", dependency: request.dependency })
    : resolved(request.dependency);

const mapTextToOutsideParty = (request: { readonly text: string }): OutsideParty => {
  if (request.text.endsWith(SCHEME_SEPARATOR)) {
    return { kind: "scheme", scheme: request.text };
  }
  return request.text.includes(SCHEME_SEPARATOR)
    ? { kind: "scheme-module", specifier: request.text }
    : { kind: "package", dependency: request.text };
};

const checkReachOf = (request: {
  readonly checks: readonly Check[];
  readonly symptom: SymptomAddress;
  readonly check: string;
}): RecordReach => {
  const check = request.checks.find(
    (candidate) =>
      sameOwnedName({ left: candidate.symptom, right: request.symptom }) === "same" &&
      candidate.name === request.check,
  );
  return check === undefined
    ? { reaches: "unknown-check", check: request.check }
    : { reaches: "one-check", check: mapCheckToAddress({ check }) };
};

const reachOf = (request: {
  readonly checks: readonly Check[];
  readonly symptom: SymptomAddress;
  readonly recorded: RecordedReach;
}): RecordReach => {
  const { recorded } = request;
  switch (recorded.reaches) {
    case "whole-symptom":
      return { reaches: "whole-symptom" };
    case "one-check":
      return checkReachOf({
        checks: request.checks,
        symptom: request.symptom,
        check: recorded.check,
      });
  }
};

const debtReachOf = (request: {
  readonly symptom: SymptomAddress;
  readonly reach: RecordReach;
}): Resolution<SymptomReach> => {
  const { reach } = request;
  switch (reach.reaches) {
    case "whole-symptom":
    case "one-check":
      return resolved(reach);
    case "unknown-check":
      return refusedWith({
        kind: "unknown-check",
        symptom: request.symptom.name,
        check: reach.check,
      });
  }
};

const symptomFiledAt = (
  request: Resolving & {
    readonly kind: NamedFolderKind;
    readonly ruleSet: RuleSetIdentity;
    readonly recorded: RecordedReach;
  },
): Resolution<RecordedSymptom> => {
  const symptom = symptomNamed({
    symptoms: request.symptoms,
    ruleSet: request.ruleSet,
    name: request.recorded.symptom,
  });
  const placed = placedIn({
    file: request.file,
    ruleSet: request.ruleSet,
    kind: request.kind,
    name: request.recorded.symptom,
  });
  if (symptom.outcome === "failed" || placed.outcome === "failed") {
    return { outcome: "failed", error: [...refusalsOf(symptom), ...refusalsOf(placed)] };
  }
  return resolved({
    symptom: symptom.value,
    reach: reachOf({
      checks: request.checks,
      symptom: symptom.value,
      recorded: request.recorded,
    }),
  });
};

const debtSymptomFiledAt = (
  request: Resolving & { readonly ruleSet: RuleSetIdentity; readonly recorded: RecordedReach },
): Resolution<DebtSymptom> => {
  const filed = symptomFiledAt({ ...request, kind: "debt" });
  if (filed.outcome === "failed") {
    return filed;
  }
  const reach = debtReachOf(filed.value);
  return reach.outcome === "failed"
    ? reach
    : resolved({
        symptom: mapSymptomToAddress({ symptom: filed.value.symptom }),
        reach: reach.value,
      });
};

const debtHoldingOf = (
  request: Resolving & { readonly carried: ReadonlyJsonValue | undefined },
): Resolution<Debt["holding"]> => {
  if (request.carried === undefined) {
    return resolved({ held: "stated" });
  }
  const standing = carriedStandingOf(request);
  return standing.outcome === "failed"
    ? standing
    : resolved({ held: "carried", entry: request.carried, lacks: [], standing: standing.value });
};

const debtOf = (request: Resolving & { readonly ruleSet: RuleSetIdentity }): Resolution<Debt> => {
  const form = formOf({ schema: debtWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const { answers: recorded, file, note, carried } = form.value;
  const symptom = debtSymptomFiledAt({ ...request, recorded });
  const holding = debtHoldingOf({ ...request, carried });
  if (symptom.outcome === "failed" || holding.outcome === "failed") {
    return { outcome: "failed", error: [...refusalsOf(symptom), ...refusalsOf(holding)] };
  }
  return resolved({
    kind: "debt",
    ...symptom.value,
    file,
    ...(note === undefined ? {} : { note }),
    holding: holding.value,
  });
};

const resolveAuthorisedReach = (request: {
  readonly symptom: Symptom;
  readonly reach: RecordReach;
}): Resolution<AuthorisedReach> => {
  const { reach } = request;
  switch (reach.reaches) {
    case "whole-symptom":
      return refusedWith({ kind: "no-check-named", symptom: request.symptom.name });
    case "one-check":
    case "unknown-check":
      return resolved(reach);
  }
};

const resolveAuthorisedSymptom = (
  request: Resolving & { readonly ruleSet: RuleSetIdentity; readonly recorded: RecordedReach },
): Resolution<AuthorisedSymptom> => {
  const filed = symptomFiledAt({ ...request, kind: "authorised-locations" });
  if (filed.outcome === "failed") {
    return filed;
  }
  const reach = resolveAuthorisedReach(filed.value);
  return reach.outcome === "failed"
    ? reach
    : resolved({ symptom: filed.value.symptom, reach: reach.value });
};

const resolveAuthorisation = (request: {
  readonly symptom: Symptom;
  readonly held: HeldAs;
}): Resolution<Binding> => {
  const authorisation = mapSymptomToAuthorisation(request);
  if (authorisation !== "no-correct-use") {
    return resolved(authorisation);
  }
  return request.held === "carried"
    ? resolved("check-and-file")
    : refusedWith({ kind: "no-authorised-correct-use", symptom: request.symptom.name });
};

const resolveStatedParty = (request: { readonly text: string }): Resolution<StatedOutsideParty> => {
  const party = mapTextToOutsideParty(request);
  return party.kind === "scheme"
    ? refusedWith({ kind: "scheme-party-stated", outsideParty: request.text })
    : resolved(party);
};

const resolveCarriedParty = (request: { readonly text: string }): Resolution<OutsideParty> =>
  resolved(mapTextToOutsideParty(request));

const resolveBinding = <Party extends OutsideParty>(request: {
  readonly symptom: Symptom;
  readonly outsideParty: string | undefined;
  readonly held: HeldAs;
  readonly resolveParty: (party: { readonly text: string }) => Resolution<Party>;
}): Resolution<AuthorisedBinding<Party>> => {
  const authorisation = resolveAuthorisation(request);
  if (authorisation.outcome === "failed") {
    return authorisation;
  }
  const { outsideParty } = request;
  if (authorisation.value === "check-and-file") {
    return outsideParty === undefined
      ? resolved({ binds: "check-and-file" })
      : refusedWith({ kind: "outside-party-not-bound", symptom: request.symptom.name });
  }
  if (outsideParty === undefined) {
    return refusedWith({ kind: "outside-party-missing", symptom: request.symptom.name });
  }
  const party = request.resolveParty({ text: outsideParty });
  return party.outcome === "failed"
    ? party
    : resolved({ binds: "check-file-and-outside-party", outsideParty: party.value });
};

const resolveStatedAuthorisedLocation = (
  request: Resolving & { readonly ruleSet: RuleSetIdentity },
): Resolution<AuthorisedLocation> => {
  const form = formOf({ schema: statedAuthorisedLocationWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const filed = resolveAuthorisedSymptom({ ...request, recorded: form.value.answers });
  if (filed.outcome === "failed") {
    return filed;
  }
  const binding = resolveBinding({
    symptom: filed.value.symptom,
    outsideParty: form.value.outsideParty,
    held: "stated",
    resolveParty: resolveStatedParty,
  });
  if (binding.outcome === "failed") {
    return binding;
  }
  return resolved({
    kind: "authorised-location",
    symptom: mapSymptomToAddress({ symptom: filed.value.symptom }),
    reach: filed.value.reach,
    file: form.value.file,
    holding: {
      held: "stated",
      binding: binding.value,
      owing: owedBy({ cases: request.cases, case: form.value.case, owes: form.value.owes }),
      whyChain: form.value.whyChain,
    },
  });
};

const resolveCarriedAuthorisedLocation = (
  request: Resolving & { readonly ruleSet: RuleSetIdentity },
): Resolution<AuthorisedLocation> => {
  const form = formOf({ schema: carriedAuthorisedLocationWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const filed = resolveAuthorisedSymptom({ ...request, recorded: form.value.answers });
  const binding =
    filed.outcome === "failed"
      ? filed
      : resolveBinding({
          symptom: filed.value.symptom,
          outsideParty: form.value.outsideParty,
          held: "carried",
          resolveParty: resolveCarriedParty,
        });
  const standing = carriedStandingOf(request);
  if (filed.outcome === "failed" || binding.outcome === "failed" || standing.outcome === "failed") {
    return {
      outcome: "failed",
      error: [...refusalsOf(binding), ...refusalsOf(standing)],
    };
  }
  return resolved({
    kind: "authorised-location",
    symptom: mapSymptomToAddress({ symptom: filed.value.symptom }),
    reach: filed.value.reach,
    file: form.value.file,
    holding: {
      held: "carried",
      binding: binding.value,
      entry: form.value.carried,
      lacks: ["case", "owes", "whyChain"],
      standing: standing.value,
    },
  });
};

const authorisedLocationOf = (
  request: Resolving & { readonly ruleSet: RuleSetIdentity },
): Resolution<AuthorisedLocation> =>
  carriedForm(request) === "carried"
    ? resolveCarriedAuthorisedLocation(request)
    : resolveStatedAuthorisedLocation(request);

const recipeReasonHeld = (request: {
  readonly recipe: Recipe;
  readonly recipeReason: string;
}): Resolution<Recipe> =>
  request.recipe.reason.text === request.recipeReason
    ? resolved(request.recipe)
    : refusedWith({ kind: "recipe-reason-not-the-catalogues", ...request });

const deviationOf = (
  request: Resolving & { readonly ruleSet: RuleSetIdentity },
): Resolution<Deviation> => {
  const form = formOf({ schema: deviationWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const { recipe: name, file, recipeReason, reasonFails, evidence, ruleHolds } = form.value;
  const found = recipeNamed({ recipes: request.recipes, ruleSet: request.ruleSet, name });
  const recipe =
    found.outcome === "failed" ? found : recipeReasonHeld({ recipe: found.value, recipeReason });
  const placed = placedIn({
    file: request.file,
    ruleSet: request.ruleSet,
    kind: "deviations",
    name,
  });
  if (recipe.outcome === "failed" || placed.outcome === "failed") {
    return { outcome: "failed", error: [...refusalsOf(recipe), ...refusalsOf(placed)] };
  }
  return resolved({
    kind: "deviation",
    recipe: recipe.value,
    file,
    reasonFails,
    evidence,
    ruleHolds,
  });
};

const dependencyRecordOf = (request: Resolving): Resolution<DependencyRecord> => {
  const form = formOf({ schema: dependencyRecordWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const { nativeWay, whyNotEnough, peerRisk } = form.value;
  const dependency = notBanned({ namedBans: request.namedBans, dependency: form.value.dependency });
  return dependency.outcome === "failed"
    ? dependency
    : resolved({
        kind: "dependency-record",
        dependency: dependency.value,
        nativeWay,
        whyNotEnough,
        ...(peerRisk === undefined ? {} : { peerRisk }),
      });
};

export const recordOf = (
  request: Resolving & { readonly filedUnder: FiledUnder },
): Resolution<HoneRecord> => {
  const { filedUnder } = request;
  switch (filedUnder.kind) {
    case "debt":
      return debtOf({ ...request, ruleSet: filedUnder.ruleSet });
    case "authorised-locations":
      return authorisedLocationOf({ ...request, ruleSet: filedUnder.ruleSet });
    case "deviations":
      return deviationOf({ ...request, ruleSet: filedUnder.ruleSet });
    case "dependency-records":
      return dependencyRecordOf(request);
  }
};
