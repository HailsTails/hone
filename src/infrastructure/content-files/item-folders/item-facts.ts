import { z } from "zod";
import type { Result } from "../../../domain/result.ts";
import { caseWireSchema, catalogueFileSchema, checkWireSchema, recordKindWireSchema, symptomWireSchema } from "../symptom-catalogues/symptom-catalogue-wire.ts";
import type { ItemKind } from "./item-identity.ts";

const OMITTED_NAME_AND_TITLE = { name: true, title: true } as const;

const principleFactsSchema = catalogueFileSchema.shape.principles.element.omit(OMITTED_NAME_AND_TITLE);

const ruleFactsSchema = catalogueFileSchema.shape.rules.element.omit(OMITTED_NAME_AND_TITLE).extend({ namedBans: z.array(z.string().min(1)).min(1).optional() });

const caseFactsSchema = caseWireSchema.omit(OMITTED_NAME_AND_TITLE);

const recipeFactsSchema = catalogueFileSchema.shape.recipes.element.omit(OMITTED_NAME_AND_TITLE);

const recordKindFactsSchema = recordKindWireSchema.omit({ ...OMITTED_NAME_AND_TITLE, todaysFormat: true });

const symptomFactsSchema = symptomWireSchema.omit(OMITTED_NAME_AND_TITLE);

const checkFactsSchema = checkWireSchema.omit({ symptom: true, name: true, clause: true });

export type ItemFacts =
  | { readonly kind: "principle"; readonly facts: z.output<typeof principleFactsSchema> }
  | { readonly kind: "rule"; readonly facts: z.output<typeof ruleFactsSchema> }
  | { readonly kind: "case"; readonly facts: z.output<typeof caseFactsSchema> }
  | { readonly kind: "recipe"; readonly facts: z.output<typeof recipeFactsSchema> }
  | { readonly kind: "record-kind"; readonly facts: z.output<typeof recordKindFactsSchema> }
  | { readonly kind: "symptom"; readonly facts: z.output<typeof symptomFactsSchema> }
  | { readonly kind: "check"; readonly facts: z.output<typeof checkFactsSchema> };

const itemOf = <Facts>(request: { readonly result: z.ZodSafeParseResult<Facts>; readonly toItem: (facts: Facts) => ItemFacts }): Result<ItemFacts, string> =>
  request.result.success ? { outcome: "ok", value: request.toItem(request.result.data) } : { outcome: "failed", error: z.prettifyError(request.result.error) };

export const itemFactsOf = (request: { readonly kind: ItemKind; readonly facts: unknown }): Result<ItemFacts, string> => {
  const { facts } = request;
  switch (request.kind) {
    case "principle":
      return itemOf({ result: principleFactsSchema.safeParse(facts), toItem: (parsed) => ({ kind: "principle", facts: parsed }) });
    case "rule":
      return itemOf({ result: ruleFactsSchema.safeParse(facts), toItem: (parsed) => ({ kind: "rule", facts: parsed }) });
    case "case":
      return itemOf({ result: caseFactsSchema.safeParse(facts), toItem: (parsed) => ({ kind: "case", facts: parsed }) });
    case "recipe":
      return itemOf({ result: recipeFactsSchema.safeParse(facts), toItem: (parsed) => ({ kind: "recipe", facts: parsed }) });
    case "record-kind":
      return itemOf({ result: recordKindFactsSchema.safeParse(facts), toItem: (parsed) => ({ kind: "record-kind", facts: parsed }) });
    case "symptom":
      return itemOf({ result: symptomFactsSchema.safeParse(facts), toItem: (parsed) => ({ kind: "symptom", facts: parsed }) });
    case "check":
      return itemOf({ result: checkFactsSchema.safeParse(facts), toItem: (parsed) => ({ kind: "check", facts: parsed }) });
  }
};
