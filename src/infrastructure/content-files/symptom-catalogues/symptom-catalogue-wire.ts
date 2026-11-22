import { z } from "zod";
import { clauseAddressSchema } from "../../discipline-exceptions-folder/clause-address.ts";
import { clauseAddressText, sameClauseAddress } from "../../../domain/rule-set/clause-address.ts";
import { checksOf } from "../../../domain/language-layer/check-address.ts";
import { CATALOGUE_NAME } from "../../../domain/language-layer/catalogue-name.ts";
import { engineIdSchema } from "../../hone-config-file/identifiers.ts";
import type { Result } from "../../../domain/result.ts";
import type {
  AlwaysRecordable,
  Case,
  CatalogueContent,
  CataloguedClause,
  CheckContent,
  ClauseSight,
  CorrectUse,
  Engine,
  FormSight,
  Indication,
  NamedBan,
  Pointed,
  Principle,
  Recipe,
  RecordKind,
  Rule,
  Symptom,
} from "../../../domain/language-layer/symptom-catalogue.ts";

export const SUPPORTED_VERSION = 1;

const NOT_A_CATALOGUE_NAME = "is not a lower-case hyphenated name";

export const catalogueNameSchema = z.string().regex(new RegExp(`^${CATALOGUE_NAME}$`), { error: NOT_A_CATALOGUE_NAME });

const textSchema = z.string().min(1);

const standingSchema = z.enum(["accepted", "proposed"]);

export const recordKindNameSchema = z.enum(["authorised-location", "deviation", "debt", "boundary-record", "dependency-record"]);

export const pointedWireSchema = z.union([z.strictObject({ rule: catalogueNameSchema }), z.strictObject({ principle: catalogueNameSchema })]);

export const caseWireSchema = z.strictObject({ name: catalogueNameSchema, title: textSchema, standing: standingSchema, owes: z.array(pointedWireSchema).min(1) });

const correctUseWireSchema = z.strictObject({ situation: textSchema, kind: recordKindNameSchema, at: textSchema.optional() });

export const seenBySchema = z.enum(["syntax", "types", "graph", "app", "files", "history", "person"]);

export const reportsSchema = z.enum(["seen", "seen-to-breach"]);

export const symptomWireSchema = z.strictObject({
  name: catalogueNameSchema,
  title: textSchema,
  group: textSchema,
  seen: textSchema,
  mayIndicate: z
    .array(z.strictObject({ case: catalogueNameSchema, situation: textSchema.optional(), quote: textSchema.optional(), points: z.array(pointedWireSchema).min(1) }))
    .min(1),
  breachUsuallySits: textSchema,
  seenBy: z.array(seenBySchema).min(1),
  reports: reportsSchema.optional(),
  recipes: z.array(catalogueNameSchema),
  correctUses: z.array(correctUseWireSchema),
  howItIsSeen: textSchema.optional(),
  breachACheckCouldName: textSchema.optional(),
  toNameTheBreach: textSchema.optional(),
});

export const sightWireSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("one-symptom"), symptom: catalogueNameSchema }),
  z.strictObject({
    kind: z.literal("symptom-by-form"),
    forms: z.array(z.strictObject({ section: textSchema, symptom: catalogueNameSchema })).min(1),
  }),
  z.strictObject({ kind: z.literal("method"), recipe: catalogueNameSchema, outcomeSeenBy: z.array(catalogueNameSchema).min(1) }),
  z.strictObject({ kind: z.literal("outside-the-cases") }),
]);

export const recordKindWireSchema = z.strictObject({
  name: recordKindNameSchema,
  title: textSchema,
  phrase: textSchema,
  todaysFormat: z.enum(["authorised-location", "file-carve-out", "none-yet"]),
});

export const checkWireSchema = z.strictObject({
  symptom: catalogueNameSchema,
  name: catalogueNameSchema,
  clause: clauseAddressSchema,
  flagsBeyondTheSymptom: textSchema.optional(),
  misses: textSchema.optional(),
  settingsTracedTo: textSchema.optional(),
});

export const catalogueFileSchema = z.strictObject({
  version: z.literal(SUPPORTED_VERSION),
  principles: z.array(z.strictObject({ name: catalogueNameSchema, title: textSchema })),
  rules: z.array(z.strictObject({ name: catalogueNameSchema, title: textSchema, principle: catalogueNameSchema, standing: standingSchema })),
  cases: z.array(caseWireSchema),
  recipes: z.array(
    z.strictObject({
      name: catalogueNameSchema,
      title: textSchema,
      serves: pointedWireSchema,
      standing: standingSchema,
      reason: z.strictObject({ text: textSchema, standing: standingSchema }),
    }),
  ),
  recordKinds: z.array(recordKindWireSchema),
  engines: z.array(z.strictObject({ name: engineIdSchema })),
  symptoms: z.array(symptomWireSchema),
  clauses: z.array(z.strictObject({ clause: clauseAddressSchema, sight: sightWireSchema })),
  checks: z.array(checkWireSchema),
  namedBans: z.array(z.strictObject({ outsideDependency: textSchema })),
});

export type CatalogueFile = z.infer<typeof catalogueFileSchema>;

type PrincipleWire = CatalogueFile["principles"][number];

type RuleWire = CatalogueFile["rules"][number];

type CaseWire = z.infer<typeof caseWireSchema>;

type RecipeWire = CatalogueFile["recipes"][number];

type RecordKindWire = z.infer<typeof recordKindWireSchema>;

type EngineWire = CatalogueFile["engines"][number];

type SymptomWire = z.infer<typeof symptomWireSchema>;

type PointedWire = z.infer<typeof pointedWireSchema>;

type CorrectUseWire = z.infer<typeof correctUseWireSchema>;

type SightWire = z.infer<typeof sightWireSchema>;

type CheckWire = z.infer<typeof checkWireSchema>;

type NamedBanWire = CatalogueFile["namedBans"][number];

type Resolution<Value> = Result<Value, readonly string[]>;

const resolved = <Value>(found: Value): Resolution<Value> => ({ outcome: "ok", value: found });

const faultsOf = <Value>(resolution: Resolution<Value>): readonly string[] => (resolution.outcome === "failed" ? resolution.error : []);

const allResolved = <Value>(resolutions: readonly Resolution<Value>[]): Resolution<readonly Value[]> => {
  const faults = resolutions.flatMap(faultsOf);
  return faults.length > 0
    ? { outcome: "failed", error: faults }
    : resolved(resolutions.flatMap((resolution) => (resolution.outcome === "ok" ? [resolution.value] : [])));
};

const mapped = <From, To>(request: { readonly resolution: Resolution<From>; readonly to: (from: From) => To }): Resolution<To> =>
  request.resolution.outcome === "failed" ? request.resolution : resolved(request.to(request.resolution.value));

const entryNamed = <Entry extends { readonly name: string }>(request: {
  readonly entries: readonly Entry[];
  readonly name: string;
  readonly refusal: string;
}): Resolution<Entry> => {
  const entry = request.entries.find((candidate) => candidate.name === request.name);
  return entry === undefined ? { outcome: "failed", error: [request.refusal] } : resolved(entry);
};

const notHeldRefusal = (request: { readonly listing: string; readonly name: string }): string =>
  `${request.listing} names ${request.name}, which the catalogue does not hold`;

const heldEntryNamed = <Entry extends { readonly name: string }>(request: {
  readonly listing: string;
  readonly entries: readonly Entry[];
  readonly name: string;
}): Resolution<Entry> => entryNamed({ ...request, refusal: notHeldRefusal(request) });

type Pointable = { readonly principles: readonly Principle[]; readonly rules: readonly Rule[] };

type Definitions = Pointable & {
  readonly cases: readonly Case[];
  readonly recipes: readonly Recipe[];
  readonly recordKinds: readonly RecordKind[];
  readonly alwaysRecordable: AlwaysRecordable;
  readonly engines: readonly Engine[];
};

const principleOf = (wire: PrincipleWire): Principle => ({ name: wire.name, title: wire.title });

const recipeOf = (wire: RecipeWire): Recipe => ({
  name: wire.name,
  title: wire.title,
  standing: wire.standing,
  reason: { text: wire.reason.text, standing: wire.reason.standing },
});

const recordKindOf = (wire: RecordKindWire): RecordKind => ({
  name: wire.name,
  title: wire.title,
  phrase: wire.phrase,
  todaysFormat: wire.todaysFormat,
});

const engineOf = (wire: EngineWire): Engine => ({ name: wire.name });

const namedBanOf = (wire: NamedBanWire): NamedBan => ({ outsideDependency: wire.outsideDependency });

const ruleOf = (request: { readonly wire: RuleWire; readonly principles: readonly Principle[] }): Resolution<Rule> =>
  mapped({
    resolution: heldEntryNamed({ listing: "rules", entries: request.principles, name: request.wire.principle }),
    to: (principle) => ({ name: request.wire.name, title: request.wire.title, principle, standing: request.wire.standing }),
  });

const pointedOf = (request: { readonly listing: string; readonly point: PointedWire; readonly pointable: Pointable }): Resolution<Pointed> =>
  "rule" in request.point
    ? mapped({
        resolution: heldEntryNamed({ listing: request.listing, entries: request.pointable.rules, name: request.point.rule }),
        to: (rule): Pointed => ({ kind: "rule", rule }),
      })
    : mapped({
        resolution: heldEntryNamed({ listing: request.listing, entries: request.pointable.principles, name: request.point.principle }),
        to: (principle): Pointed => ({ kind: "principle", principle }),
      });

const caseOf = (request: { readonly wire: CaseWire; readonly pointable: Pointable }): Resolution<Case> =>
  mapped({
    resolution: allResolved(request.wire.owes.map((point) => pointedOf({ listing: "cases", point, pointable: request.pointable }))),
    to: (owes) => ({ name: request.wire.name, title: request.wire.title, standing: request.wire.standing, owes }),
  });

const alwaysRecordableKindOf = (request: { readonly recordKinds: readonly RecordKind[]; readonly name: string }): Resolution<RecordKind> =>
  entryNamed({ entries: request.recordKinds, name: request.name, refusal: `recordKinds holds no ${request.name}, which every symptom takes` });

const alwaysRecordableOf = (request: { readonly recordKinds: readonly RecordKind[] }): Resolution<AlwaysRecordable> => {
  const debt = alwaysRecordableKindOf({ ...request, name: "debt" });
  const authorisedLocation = alwaysRecordableKindOf({ ...request, name: "authorised-location" });
  return debt.outcome === "failed" || authorisedLocation.outcome === "failed"
    ? { outcome: "failed", error: [...faultsOf(debt), ...faultsOf(authorisedLocation)] }
    : resolved({ debt: debt.value, authorisedLocation: authorisedLocation.value });
};

const pointableOf = (request: { readonly file: CatalogueFile }): Resolution<Pointable> => {
  const principles = request.file.principles.map(principleOf);
  return mapped({
    resolution: allResolved(request.file.rules.map((wire) => ruleOf({ wire, principles }))),
    to: (rules) => ({ principles, rules }),
  });
};

const definitionsOf = (request: { readonly file: CatalogueFile }): Resolution<Definitions> => {
  const pointable = pointableOf(request);
  if (pointable.outcome === "failed") {
    return pointable;
  }
  const recordKinds = request.file.recordKinds.map(recordKindOf);
  const cases = allResolved(request.file.cases.map((wire) => caseOf({ wire, pointable: pointable.value })));
  const alwaysRecordable = alwaysRecordableOf({ recordKinds });
  const served = allResolved(request.file.recipes.map((wire) => pointedOf({ listing: "recipes", point: wire.serves, pointable: pointable.value })));
  return cases.outcome === "failed" || alwaysRecordable.outcome === "failed" || served.outcome === "failed"
    ? { outcome: "failed", error: [...faultsOf(cases), ...faultsOf(alwaysRecordable), ...faultsOf(served)] }
    : resolved({
        ...pointable.value,
        cases: cases.value,
        recipes: request.file.recipes.map(recipeOf),
        recordKinds,
        alwaysRecordable: alwaysRecordable.value,
        engines: request.file.engines.map(engineOf),
      });
};

const indicationOf = (request: { readonly indication: SymptomWire["mayIndicate"][number]; readonly definitions: Definitions }): Resolution<Indication> => {
  const indicated = heldEntryNamed({ listing: "symptoms", entries: request.definitions.cases, name: request.indication.case });
  const points = allResolved(request.indication.points.map((point) => pointedOf({ listing: "symptoms", point, pointable: request.definitions })));
  return indicated.outcome === "failed" || points.outcome === "failed"
    ? { outcome: "failed", error: [...faultsOf(indicated), ...faultsOf(points)] }
    : resolved(
        request.indication.situation === undefined
          ? { case: indicated.value, points: points.value }
          : { case: indicated.value, situation: request.indication.situation, points: points.value },
      );
};

const correctUseOf = (request: { readonly use: CorrectUseWire; readonly definitions: Definitions }): Resolution<CorrectUse> =>
  mapped({
    resolution: heldEntryNamed({ listing: "symptoms", entries: request.definitions.recordKinds, name: request.use.kind }),
    to: (kind): CorrectUse =>
      request.use.at === undefined ? { situation: request.use.situation, kind } : { situation: request.use.situation, kind, at: request.use.at },
  });

const symptomOf = (request: { readonly wire: SymptomWire; readonly definitions: Definitions }): Resolution<Symptom> => {
  const { wire, definitions } = request;
  const mayIndicate = allResolved(wire.mayIndicate.map((indication) => indicationOf({ indication, definitions })));
  const recipes = allResolved(wire.recipes.map((name) => heldEntryNamed({ listing: "symptoms", entries: definitions.recipes, name })));
  const correctUses = allResolved(wire.correctUses.map((use) => correctUseOf({ use, definitions })));
  if (mayIndicate.outcome === "failed" || recipes.outcome === "failed" || correctUses.outcome === "failed") {
    return { outcome: "failed", error: [...faultsOf(mayIndicate), ...faultsOf(recipes), ...faultsOf(correctUses)] };
  }
  return resolved({
    name: wire.name,
    title: wire.title,
    seen: wire.seen,
    mayIndicate: mayIndicate.value,
    breachUsuallySits: wire.breachUsuallySits,
    recipes: recipes.value,
    correctUses: correctUses.value,
  });
};

type Sighting = { readonly symptoms: readonly Symptom[]; readonly recipes: readonly Recipe[] };

const sightedSymptomOf = (request: Sighting & { readonly name: string }): Resolution<Symptom> =>
  heldEntryNamed({ listing: "clauses", entries: request.symptoms, name: request.name });

const methodSightOf = (request: Sighting & { readonly sight: Extract<SightWire, { readonly kind: "method" }> }): Resolution<ClauseSight> => {
  const recipe = heldEntryNamed({ listing: "clauses", entries: request.recipes, name: request.sight.recipe });
  const outcomeSeenBy = allResolved(request.sight.outcomeSeenBy.map((name) => sightedSymptomOf({ ...request, name })));
  return recipe.outcome === "failed" || outcomeSeenBy.outcome === "failed"
    ? { outcome: "failed", error: [...faultsOf(recipe), ...faultsOf(outcomeSeenBy)] }
    : resolved({ kind: "method", recipe: recipe.value, outcomeSeenBy: outcomeSeenBy.value });
};

const sightOf = (request: Sighting & { readonly sight: SightWire }): Resolution<ClauseSight> => {
  const { sight } = request;
  switch (sight.kind) {
    case "one-symptom":
      return mapped({ resolution: sightedSymptomOf({ ...request, name: sight.symptom }), to: (symptom): ClauseSight => ({ kind: "one-symptom", symptom }) });
    case "symptom-by-form":
      return mapped({
        resolution: allResolved(
          sight.forms.map((form) =>
            mapped({ resolution: sightedSymptomOf({ ...request, name: form.symptom }), to: (symptom): FormSight => ({ section: form.section, symptom }) }),
          ),
        ),
        to: (forms): ClauseSight => ({ kind: "symptom-by-form", forms }),
      });
    case "method":
      return methodSightOf({ ...request, sight });
    case "outside-the-cases":
      return resolved({ kind: "outside-the-cases" });
  }
};

const clauseOf = (request: Sighting & { readonly wire: CatalogueFile["clauses"][number] }): Resolution<CataloguedClause> =>
  mapped({ resolution: sightOf({ ...request, sight: request.wire.sight }), to: (sight) => ({ clause: request.wire.clause, sight }) });

const sightedSymptomsOf = (request: { readonly sight: ClauseSight }): readonly Symptom[] => {
  switch (request.sight.kind) {
    case "one-symptom":
      return [request.sight.symptom];
    case "symptom-by-form":
      return request.sight.forms.map((form) => form.symptom);
    case "method":
    case "outside-the-cases":
      return [];
  }
};

const sightedNamesOf = (request: { readonly clause: CataloguedClause }): readonly string[] => [
  ...new Set(sightedSymptomsOf({ sight: request.clause.sight }).map((symptom) => symptom.name)),
];

const formsOf = (request: { readonly clause: CataloguedClause; readonly symptom: Symptom }): readonly string[] =>
  request.clause.sight.kind === "symptom-by-form"
    ? request.clause.sight.forms.filter((form) => form.symptom.name === request.symptom.name).map((form) => form.section)
    : [];

type Checking = { readonly symptoms: readonly Symptom[]; readonly clauses: readonly CataloguedClause[] };

const checkedClauseOf = (request: Checking & { readonly wire: CheckWire }): Resolution<CataloguedClause> => {
  const clause = request.clauses.find((candidate) => sameClauseAddress({ left: candidate.clause, right: request.wire.clause }) === "same");
  return clause === undefined
    ? { outcome: "failed", error: [notHeldRefusal({ listing: "checks", name: clauseAddressText({ address: request.wire.clause }) })] }
    : resolved(clause);
};

const sightedCheckOf = (request: {
  readonly wire: CheckWire;
  readonly symptom: Symptom;
  readonly clause: CataloguedClause;
}): Resolution<CheckContent> =>
  sightedNamesOf({ clause: request.clause }).includes(request.symptom.name)
    ? resolved({
        name: request.wire.name,
        symptom: request.symptom,
        clause: request.clause.clause,
        forms: formsOf({ clause: request.clause, symptom: request.symptom }),
      })
    : {
        outcome: "failed",
        error: [
          `checks names ${request.symptom.name}#${request.wire.name} on ${clauseAddressText({ address: request.clause.clause })}, which does not see ${request.symptom.name}`,
        ],
      };

const checkOf = (request: Checking & { readonly wire: CheckWire }): Resolution<CheckContent> => {
  const { wire } = request;
  const symptom = heldEntryNamed({ listing: "checks", entries: request.symptoms, name: wire.symptom });
  const clause = checkedClauseOf(request);
  return symptom.outcome === "failed" || clause.outcome === "failed"
    ? { outcome: "failed", error: [...faultsOf(symptom), ...faultsOf(clause)] }
    : sightedCheckOf({ wire, symptom: symptom.value, clause: clause.value });
};

const uncheckedSightingsOf = (request: { readonly clause: CataloguedClause; readonly checks: readonly CheckContent[] }): readonly string[] => {
  const checked = checksOf({ catalogue: request, clause: request.clause.clause });
  return checked.length === 0
    ? []
    : sightedNamesOf(request)
        .filter((name) => !checked.some((check) => check.symptom.name === name))
        .map((name) => `${clauseAddressText({ address: request.clause.clause })} sees ${name}, which no check names`);
};

const resolvedChecksOf = (request: Checking & { readonly wires: readonly CheckWire[] }): Resolution<readonly CheckContent[]> => {
  const checks = allResolved(request.wires.map((wire) => checkOf({ ...request, wire })));
  if (checks.outcome === "failed") {
    return checks;
  }
  const unchecked = request.clauses.flatMap((clause) => uncheckedSightingsOf({ clause, checks: checks.value }));
  return unchecked.length > 0 ? { outcome: "failed", error: unchecked } : checks;
};

const catalogueOf = (request: { readonly file: CatalogueFile }): Resolution<CatalogueContent> => {
  const definitions = definitionsOf(request);
  if (definitions.outcome === "failed") {
    return definitions;
  }
  const symptoms = allResolved(request.file.symptoms.map((wire) => symptomOf({ wire, definitions: definitions.value })));
  if (symptoms.outcome === "failed") {
    return symptoms;
  }
  const sighting: Sighting = { symptoms: symptoms.value, recipes: definitions.value.recipes };
  const clauses = allResolved(request.file.clauses.map((wire) => clauseOf({ ...sighting, wire })));
  if (clauses.outcome === "failed") {
    return clauses;
  }
  return mapped({
    resolution: resolvedChecksOf({ symptoms: symptoms.value, clauses: clauses.value, wires: request.file.checks }),
    to: (checks) => ({
      ...definitions.value,
      symptoms: symptoms.value,
      clauses: clauses.value,
      checks,
      namedBans: request.file.namedBans.map(namedBanOf),
    }),
  });
};

const repeatsIn = (request: { readonly listing: string; readonly names: readonly string[] }): readonly string[] =>
  request.names
    .filter((name, index) => request.names.indexOf(name) !== index)
    .map((name) => `${request.listing} holds ${name} more than once`);

const formSectionRepeatsOf = (request: { readonly file: CatalogueFile }): readonly string[] =>
  request.file.clauses.flatMap(({ clause, sight }) =>
    sight.kind === "symptom-by-form"
      ? repeatsIn({ listing: `the forms of ${clauseAddressText({ address: clause })}`, names: sight.forms.map((form) => form.section) })
      : [],
  );

const indicatedCaseRepeatsOf = (request: { readonly file: CatalogueFile }): readonly string[] =>
  request.file.symptoms.flatMap((symptom) =>
    repeatsIn({
      listing: `the cases of ${symptom.name}`,
      names: symptom.mayIndicate.map((indication) => (indication.situation === undefined ? indication.case : `${indication.case}: ${indication.situation}`)),
    }),
  );

const checkedClauseRepeatsOf = (request: { readonly file: CatalogueFile }): readonly string[] =>
  [...new Set(request.file.checks.map((check) => check.symptom))].flatMap((symptom) =>
    repeatsIn({
      listing: `the checks of ${symptom}`,
      names: request.file.checks.filter((check) => check.symptom === symptom).map((check) => clauseAddressText({ address: check.clause })),
    }),
  );

const repeatedNamesOf = (request: { readonly file: CatalogueFile }): readonly string[] => [
  ...repeatsIn({ listing: "principles", names: request.file.principles.map((principle) => principle.name) }),
  ...repeatsIn({ listing: "rules", names: request.file.rules.map((rule) => rule.name) }),
  ...repeatsIn({ listing: "cases", names: request.file.cases.map((entry) => entry.name) }),
  ...repeatsIn({ listing: "recipes", names: request.file.recipes.map((recipe) => recipe.name) }),
  ...repeatsIn({ listing: "recordKinds", names: request.file.recordKinds.map((kind) => kind.name) }),
  ...repeatsIn({ listing: "engines", names: request.file.engines.map((engine) => engine.name) }),
  ...repeatsIn({ listing: "symptoms", names: request.file.symptoms.map((symptom) => symptom.name) }),
  ...repeatsIn({ listing: "clauses", names: request.file.clauses.map(({ clause }) => clauseAddressText({ address: clause })) }),
  ...repeatsIn({ listing: "checks", names: request.file.checks.map((check) => `${check.symptom}#${check.name}`) }),
  ...checkedClauseRepeatsOf(request),
  ...formSectionRepeatsOf(request),
  ...indicatedCaseRepeatsOf(request),
];

const checkedCatalogueFileSchema = catalogueFileSchema.superRefine((file, context) => {
  repeatedNamesOf({ file }).forEach((message) => {
    context.addIssue({ code: "custom", message });
  });
});

const refusalText = (request: { readonly faults: readonly string[] }): string => request.faults.map((fault) => `✖ ${fault}`).join("\n");

export const catalogueContentFromFile = (request: { readonly file: CatalogueFile }): Result<CatalogueContent, string> => {
  const repeats = repeatedNamesOf({ file: request.file });
  if (repeats.length > 0) {
    return { outcome: "failed", error: refusalText({ faults: repeats }) };
  }
  const catalogue = catalogueOf({ file: request.file });
  return catalogue.outcome === "failed" ? { outcome: "failed", error: refusalText({ faults: catalogue.error }) } : catalogue;
};

export const catalogueContentOf = (request: { readonly document: unknown }): Result<CatalogueContent, string> => {
  const parsed = checkedCatalogueFileSchema.safeParse(request.document);
  if (!parsed.success) {
    return { outcome: "failed", error: z.prettifyError(parsed.error) };
  }
  const catalogue = catalogueOf({ file: parsed.data });
  return catalogue.outcome === "failed" ? { outcome: "failed", error: refusalText({ faults: catalogue.error }) } : catalogue;
};
