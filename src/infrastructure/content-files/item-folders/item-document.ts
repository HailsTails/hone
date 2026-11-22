import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import type { Result } from "../../../domain/result.ts";
import { type CatalogueFile, recordKindNameSchema, SUPPORTED_VERSION } from "../symptom-catalogues/symptom-catalogue-wire.ts";
import type { FormatsOfToday } from "../../disciplines-file/version-one-names.ts";
import type { ItemFacts } from "./item-facts.ts";

export type PlacedItem = {
  readonly name: string;
  readonly within: string | undefined;
  readonly title: string;
  readonly item: ItemFacts;
};

export type HeldBesideItems = {
  readonly engines: CatalogueFile["engines"];
  readonly clauses: CatalogueFile["clauses"];
  readonly clauseOfCheck: ReadonlyMap<string, ClauseAddress>;
  readonly formatsOfToday: FormatsOfToday;
};

type OfKind<Kind extends ItemFacts["kind"]> = PlacedItem & { readonly item: Extract<ItemFacts, { readonly kind: Kind }> };

type Assembled<Value> = Result<Value, string>;

const ofKind =
  <Kind extends ItemFacts["kind"]>(kind: Kind) =>
  (placed: PlacedItem): placed is OfKind<Kind> =>
    placed.item.kind === kind;

const allAssembled = <Value>(assembled: readonly Assembled<Value>[]): Assembled<Value[]> => {
  const failure = assembled.find((each) => each.outcome === "failed");
  return failure?.outcome === "failed" ? failure : { outcome: "ok", value: assembled.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])) };
};

const recordKindOf = (request: { readonly placed: OfKind<"record-kind">; readonly formatsOfToday: FormatsOfToday }): Assembled<CatalogueFile["recordKinds"][number]> => {
  const { placed } = request;
  const name = recordKindNameSchema.safeParse(placed.name);
  return name.success
    ? { outcome: "ok", value: { name: name.data, title: placed.title, ...placed.item.facts, todaysFormat: request.formatsOfToday[name.data] ?? "none-yet" } }
    : { outcome: "failed", error: `${placed.name} is not the name of a record kind` };
};

const ruleOf = (placed: OfKind<"rule">): CatalogueFile["rules"][number] => ({
  name: placed.name,
  title: placed.title,
  principle: placed.item.facts.principle,
  standing: placed.item.facts.standing,
});

const checkOf = (request: { readonly placed: OfKind<"check">; readonly clauseOfCheck: ReadonlyMap<string, ClauseAddress> }): Assembled<CatalogueFile["checks"][number]> => {
  const symptom = request.placed.within ?? "";
  const address = `${symptom}#${request.placed.name}`;
  const clause = request.clauseOfCheck.get(address);
  return clause === undefined
    ? { outcome: "failed", error: `${address} is named by no clause in the version 1 names` }
    : { outcome: "ok", value: { symptom, name: request.placed.name, clause, ...request.placed.item.facts } };
};

const unheldChecksOf = (request: { readonly checks: readonly CatalogueFile["checks"][number][]; readonly clauseOfCheck: ReadonlyMap<string, ClauseAddress> }): readonly string[] => {
  const held = new Set(request.checks.map((check) => `${check.symptom}#${check.name}`));
  return [...request.clauseOfCheck.keys()].filter((address) => !held.has(address));
};

export const catalogueFileOf = (request: { readonly items: readonly PlacedItem[]; readonly beside: HeldBesideItems }): Assembled<CatalogueFile> => {
  const { items, beside } = request;
  const recordKinds = allAssembled(items.filter(ofKind("record-kind")).map((placed) => recordKindOf({ placed, formatsOfToday: beside.formatsOfToday })));
  if (recordKinds.outcome === "failed") {
    return recordKinds;
  }
  const checks = allAssembled(items.filter(ofKind("check")).map((placed) => checkOf({ placed, clauseOfCheck: beside.clauseOfCheck })));
  if (checks.outcome === "failed") {
    return checks;
  }
  const [unheld] = unheldChecksOf({ checks: checks.value, clauseOfCheck: beside.clauseOfCheck });
  if (unheld !== undefined) {
    return { outcome: "failed", error: `the version 1 names give ${unheld}, which no item holds` };
  }
  const rules = items.filter(ofKind("rule"));
  return {
    outcome: "ok",
    value: {
      version: SUPPORTED_VERSION,
      principles: items.filter(ofKind("principle")).map((placed) => ({ name: placed.name, title: placed.title })),
      rules: rules.map(ruleOf),
      cases: items.filter(ofKind("case")).map((placed) => ({ name: placed.name, title: placed.title, ...placed.item.facts })),
      recipes: items.filter(ofKind("recipe")).map((placed) => ({ name: placed.name, title: placed.title, ...placed.item.facts })),
      recordKinds: recordKinds.value,
      engines: beside.engines,
      symptoms: items.filter(ofKind("symptom")).map((placed) => ({ name: placed.name, title: placed.title, ...placed.item.facts })),
      clauses: beside.clauses,
      checks: checks.value,
      namedBans: rules.flatMap((placed) => placed.item.facts.namedBans ?? []).map((outsideDependency) => ({ outsideDependency })),
    },
  };
};
