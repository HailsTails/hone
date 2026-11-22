import type { Result } from "../../../domain/result.ts";
import { type CatalogueFile, recordKindNameSchema, SUPPORTED_VERSION } from "../symptom-catalogues/symptom-catalogue-wire.ts";
import type { ItemFacts } from "./item-facts.ts";

export type PlacedItem = {
  readonly name: string;
  readonly within: string | undefined;
  readonly title: string;
  readonly item: ItemFacts;
};

export type HeldBesideItems = Pick<CatalogueFile, "engines" | "clauses" | "namedBans">;

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

const recordKindOf = (placed: OfKind<"record-kind">): Assembled<CatalogueFile["recordKinds"][number]> => {
  const name = recordKindNameSchema.safeParse(placed.name);
  return name.success
    ? { outcome: "ok", value: { name: name.data, title: placed.title, ...placed.item.facts } }
    : { outcome: "failed", error: `${placed.name} is not the name of a record kind` };
};

export const catalogueFileOf = (request: { readonly items: readonly PlacedItem[]; readonly beside: HeldBesideItems }): Assembled<CatalogueFile> => {
  const { items, beside } = request;
  const recordKinds = allAssembled(items.filter(ofKind("record-kind")).map(recordKindOf));
  if (recordKinds.outcome === "failed") {
    return recordKinds;
  }
  return {
    outcome: "ok",
    value: {
      version: SUPPORTED_VERSION,
      principles: items.filter(ofKind("principle")).map((placed) => ({ name: placed.name, title: placed.title, ...placed.item.facts })),
      rules: items.filter(ofKind("rule")).map((placed) => ({ name: placed.name, title: placed.title, ...placed.item.facts })),
      cases: items.filter(ofKind("case")).map((placed) => ({ name: placed.name, title: placed.title, ...placed.item.facts })),
      recipes: items.filter(ofKind("recipe")).map((placed) => ({ name: placed.name, title: placed.title, ...placed.item.facts })),
      recordKinds: recordKinds.value,
      engines: beside.engines,
      symptoms: items.filter(ofKind("symptom")).map((placed) => ({ name: placed.name, title: placed.title, ...placed.item.facts })),
      clauses: beside.clauses,
      checks: items.filter(ofKind("check")).map((placed) => ({ symptom: placed.within ?? "", name: placed.name, ...placed.item.facts })),
      namedBans: beside.namedBans,
    },
  };
};
