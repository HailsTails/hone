import type { z } from "zod";
import { type Case, pointedNameOf, type Recipe, type Symptom, type SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { RepoPath } from "../repo-path.ts";
import type { Result } from "../../../domain/result.ts";
import { carriedStandingOf } from "./carried-standing.ts";
import type {
  AuthorisedLocation,
  AuthorisedReach,
  BoundaryRecord,
  Debt,
  DependencyRecord,
  Deviation,
  HoneRecord,
  OutsideParty,
  Owing,
  RecordRefusal,
  RecordsAtBase,
  RuntimeFacility,
  SymptomReach,
} from "../hone-record.ts";
import { banStandingOf, dependencyOf } from "../../../domain/records/answering/outside-dependency.ts";
import { type NamedFolderKind, namedRecordsFileOf, type SingleFileKind } from "../folder-layout/records-layout.ts";
import {
  carriedAuthorisedLocationWireSchema,
  carriedBoundaryRecordWireSchema,
  carriedFormSchema,
  debtWireSchema,
  dependencyRecordWireSchema,
  deviationWireSchema,
  type RecordedReach,
  statedAuthorisedLocationWireSchema,
  statedBoundaryRecordWireSchema,
} from "../records-wire.ts";

type Resolution<Value> = Result<Value, readonly RecordRefusal[]>;

type RecordedSymptom = { readonly symptom: Symptom; readonly reach: AuthorisedReach };

type DebtSymptom = { readonly symptom: Symptom; readonly reach: SymptomReach };

export type Resolving = {
  readonly catalogue: SymptomCatalogue;
  readonly base: RecordsAtBase;
  readonly file: RepoPath;
  readonly entry: z.core.util.JSONType;
};

export type FiledUnder = { readonly kind: NamedFolderKind } | { readonly kind: SingleFileKind };

const RUNTIME_PREFIX = "runtime:";

const NPM_PREFIX = "npm:";

const SCHEME_MARK = /^[a-z][a-z0-9+.-]*:/;

const RUNTIME_FACILITIES: readonly RuntimeFacility[] = ["clock", "random", "process", "json"];

const resolved = <Value>(found: Value): Resolution<Value> => ({ outcome: "ok", value: found });

const refusedWith = (refusal: RecordRefusal): Resolution<never> => ({ outcome: "failed", error: [refusal] });

const refusalsOf = (resolution: Resolution<unknown>): readonly RecordRefusal[] => (resolution.outcome === "failed" ? resolution.error : []);

const formOf = <Output>(request: { readonly schema: z.ZodType<Output>; readonly entry: z.core.util.JSONType }): Resolution<Output> => {
  const parsed = request.schema.safeParse(request.entry);
  return parsed.success ? resolved(parsed.data) : refusedWith({ kind: "form-refused", issues: parsed.error.issues });
};

const carriedForm = (request: { readonly entry: z.core.util.JSONType }): "carried" | "stated" =>
  carriedFormSchema.safeParse(request.entry).success ? "carried" : "stated";

const symptomNamed = (request: { readonly catalogue: SymptomCatalogue; readonly name: string }): Resolution<Symptom> => {
  const symptom = request.catalogue.symptoms.find((candidate) => candidate.name === request.name);
  return symptom === undefined ? refusedWith({ kind: "unknown-symptom", symptom: request.name }) : resolved(symptom);
};

const recipeNamed = (request: { readonly catalogue: SymptomCatalogue; readonly name: string }): Resolution<Recipe> => {
  const recipe = request.catalogue.recipes.find((candidate) => candidate.name === request.name);
  return recipe === undefined ? refusedWith({ kind: "unknown-recipe", recipe: request.name }) : resolved(recipe);
};

const owedWithin = (request: { readonly case: Case; readonly owes: string }): Owing => {
  const point = request.case.owes.find((candidate) => pointedNameOf({ point: candidate }) === request.owes);
  return point === undefined
    ? { matches: "not-the-catalogue", note: { kind: "owes-not-owed", case: request.case, owes: request.owes } }
    : { matches: "the-catalogue", case: request.case, owes: point };
};

export const owedBy = (request: { readonly catalogue: SymptomCatalogue; readonly case: string; readonly owes: string }): Owing => {
  const found = request.catalogue.cases.find((candidate) => candidate.name === request.case);
  return found === undefined
    ? { matches: "not-the-catalogue", note: { kind: "unknown-case", case: request.case, owes: request.owes } }
    : owedWithin({ case: found, owes: request.owes });
};

const placedIn = (request: { readonly file: RepoPath; readonly kind: NamedFolderKind; readonly name: string }): Resolution<RepoPath> => {
  const belongsIn = namedRecordsFileOf({ kind: request.kind, name: request.name });
  if (belongsIn.outcome === "failed") {
    return refusedWith(belongsIn.error);
  }
  return request.file === belongsIn.value ? resolved(request.file) : refusedWith({ kind: "misplaced", belongsIn: belongsIn.value });
};

const notBanned = (request: { readonly catalogue: SymptomCatalogue; readonly dependency: string }): Resolution<string> =>
  banStandingOf({ namedBans: request.catalogue.namedBans, dependency: request.dependency }) === "banned"
    ? refusedWith({ kind: "named-ban", dependency: request.dependency })
    : resolved(request.dependency);

const runtimePartyOf = (request: { readonly text: string }): Resolution<OutsideParty> => {
  const facility = RUNTIME_FACILITIES.find((candidate) => `${RUNTIME_PREFIX}${candidate}` === request.text);
  return facility === undefined ? refusedWith({ kind: "unknown-runtime-facility", outsideParty: request.text }) : resolved({ kind: "runtime", facility });
};

const outsidePartyOf = (request: { readonly text: string }): Resolution<OutsideParty> => {
  if (request.text.startsWith(RUNTIME_PREFIX)) {
    return runtimePartyOf(request);
  }
  if (!request.text.startsWith(NPM_PREFIX) && SCHEME_MARK.test(request.text)) {
    return resolved({ kind: "scheme-module", specifier: request.text });
  }
  return resolved({ kind: "package", specifier: request.text, dependency: dependencyOf({ specifier: request.text }) });
};

const checkReachOf = (request: { readonly catalogue: SymptomCatalogue; readonly symptom: Symptom; readonly check: string }): AuthorisedReach => {
  const check = request.catalogue.checks.find((candidate) => candidate.symptom.name === request.symptom.name && candidate.name === request.check);
  return check === undefined ? { reaches: "unknown-check", check: request.check } : { reaches: "one-check", check };
};

const reachOf = (request: { readonly catalogue: SymptomCatalogue; readonly symptom: Symptom; readonly recorded: RecordedReach }): AuthorisedReach => {
  const { recorded } = request;
  switch (recorded.reaches) {
    case "whole-symptom":
      return { reaches: "whole-symptom" };
    case "one-check":
      return checkReachOf({ catalogue: request.catalogue, symptom: request.symptom, check: recorded.check });
  }
};

const debtReachOf = (request: { readonly symptom: Symptom; readonly reach: AuthorisedReach }): Resolution<SymptomReach> => {
  const { reach } = request;
  switch (reach.reaches) {
    case "whole-symptom":
    case "one-check":
      return resolved(reach);
    case "unknown-check":
      return refusedWith({ kind: "unknown-check", symptom: request.symptom.name, check: reach.check });
  }
};

const symptomFiledAt = (request: Resolving & { readonly kind: NamedFolderKind; readonly recorded: RecordedReach }): Resolution<RecordedSymptom> => {
  const symptom = symptomNamed({ catalogue: request.catalogue, name: request.recorded.symptom });
  const placed = placedIn({ file: request.file, kind: request.kind, name: request.recorded.symptom });
  if (symptom.outcome === "failed" || placed.outcome === "failed") {
    return { outcome: "failed", error: [...refusalsOf(symptom), ...refusalsOf(placed)] };
  }
  return resolved({ symptom: symptom.value, reach: reachOf({ catalogue: request.catalogue, symptom: symptom.value, recorded: request.recorded }) });
};

const debtSymptomFiledAt = (request: Resolving & { readonly recorded: RecordedReach }): Resolution<DebtSymptom> => {
  const filed = symptomFiledAt({ ...request, kind: "debt" });
  if (filed.outcome === "failed") {
    return filed;
  }
  const reach = debtReachOf(filed.value);
  return reach.outcome === "failed" ? reach : resolved({ symptom: filed.value.symptom, reach: reach.value });
};

const debtHoldingOf = (request: Resolving & { readonly carried: z.core.util.JSONType | undefined }): Resolution<Debt["holding"]> => {
  if (request.carried === undefined) {
    return resolved({ held: "stated" });
  }
  const standing = carriedStandingOf(request);
  return standing.outcome === "failed" ? standing : resolved({ held: "carried", entry: request.carried, lacks: [], standing: standing.value });
};

const debtOf = (request: Resolving): Resolution<Debt> => {
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
  return resolved({ kind: "debt", ...symptom.value, file, ...(note === undefined ? {} : { note }), holding: holding.value });
};

const statedAuthorisedLocationOf = (request: Resolving): Resolution<AuthorisedLocation> => {
  const form = formOf({ schema: statedAuthorisedLocationWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const symptom = symptomFiledAt({ ...request, kind: "authorised-locations", recorded: form.value.answers });
  if (symptom.outcome === "failed") {
    return symptom;
  }
  return resolved({
    kind: "authorised-location",
    ...symptom.value,
    file: form.value.file,
    holding: { held: "stated", owing: owedBy({ catalogue: request.catalogue, case: form.value.case, owes: form.value.owes }), whyChain: form.value.whyChain },
  });
};

const carriedAuthorisedLocationOf = (request: Resolving): Resolution<AuthorisedLocation> => {
  const form = formOf({ schema: carriedAuthorisedLocationWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const symptom = symptomFiledAt({ ...request, kind: "authorised-locations", recorded: form.value.answers });
  const standing = carriedStandingOf(request);
  if (symptom.outcome === "failed" || standing.outcome === "failed") {
    return { outcome: "failed", error: [...refusalsOf(symptom), ...refusalsOf(standing)] };
  }
  return resolved({
    kind: "authorised-location",
    ...symptom.value,
    file: form.value.file,
    holding: { held: "carried", entry: form.value.carried, lacks: ["case", "owes", "whyChain"], standing: standing.value },
  });
};

const authorisedLocationOf = (request: Resolving): Resolution<AuthorisedLocation> =>
  carriedForm(request) === "carried" ? carriedAuthorisedLocationOf(request) : statedAuthorisedLocationOf(request);

const statedBoundaryRecordOf = (request: Resolving): Resolution<BoundaryRecord> => {
  const form = formOf({ schema: statedBoundaryRecordWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const { module, outsideParty, ports, conformist } = form.value;
  const party = outsidePartyOf({ text: outsideParty });
  return party.outcome === "failed"
    ? party
    : resolved({ kind: "boundary-record", module, outsideParty: party.value, holding: { held: "stated", ports, ...(conformist === undefined ? {} : { conformist }) } });
};

const carriedBoundaryRecordOf = (request: Resolving): Resolution<BoundaryRecord> => {
  const form = formOf({ schema: carriedBoundaryRecordWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const party = outsidePartyOf({ text: form.value.outsideParty });
  const standing = carriedStandingOf(request);
  if (party.outcome === "failed" || standing.outcome === "failed") {
    return { outcome: "failed", error: [...refusalsOf(party), ...refusalsOf(standing)] };
  }
  return resolved({
    kind: "boundary-record",
    module: form.value.module,
    outsideParty: party.value,
    holding: { held: "carried", entry: form.value.carried, lacks: ["ports"], standing: standing.value },
  });
};

const boundaryRecordOf = (request: Resolving): Resolution<BoundaryRecord> =>
  carriedForm(request) === "carried" ? carriedBoundaryRecordOf(request) : statedBoundaryRecordOf(request);

const recipeReasonHeld = (request: { readonly recipe: Recipe; readonly recipeReason: string }): Resolution<Recipe> =>
  request.recipe.reason.text === request.recipeReason ? resolved(request.recipe) : refusedWith({ kind: "recipe-reason-not-the-catalogues", ...request });

const deviationOf = (request: Resolving): Resolution<Deviation> => {
  const form = formOf({ schema: deviationWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const { recipe: name, file, recipeReason, reasonFails, evidence, ruleHolds } = form.value;
  const found = recipeNamed({ catalogue: request.catalogue, name });
  const recipe = found.outcome === "failed" ? found : recipeReasonHeld({ recipe: found.value, recipeReason });
  const placed = placedIn({ file: request.file, kind: "deviations", name });
  if (recipe.outcome === "failed" || placed.outcome === "failed") {
    return { outcome: "failed", error: [...refusalsOf(recipe), ...refusalsOf(placed)] };
  }
  return resolved({ kind: "deviation", recipe: recipe.value, file, reasonFails, evidence, ruleHolds });
};

const dependencyRecordOf = (request: Resolving): Resolution<DependencyRecord> => {
  const form = formOf({ schema: dependencyRecordWireSchema, entry: request.entry });
  if (form.outcome === "failed") {
    return form;
  }
  const { nativeWay, whyNotEnough, peerRisk } = form.value;
  const dependency = notBanned({ catalogue: request.catalogue, dependency: form.value.dependency });
  return dependency.outcome === "failed"
    ? dependency
    : resolved({ kind: "dependency-record", dependency: dependency.value, nativeWay, whyNotEnough, ...(peerRisk === undefined ? {} : { peerRisk }) });
};

export const recordOf = (request: Resolving & { readonly filedUnder: FiledUnder }): Resolution<HoneRecord> => {
  switch (request.filedUnder.kind) {
    case "debt":
      return debtOf(request);
    case "authorised-locations":
      return authorisedLocationOf(request);
    case "deviations":
      return deviationOf(request);
    case "boundary-records":
      return boundaryRecordOf(request);
    case "dependency-records":
      return dependencyRecordOf(request);
  }
};
