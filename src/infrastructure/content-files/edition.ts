import { z } from "zod";

import { editionOrder, isEdition } from "../../domain/rule-set/edition-reach.ts";
import type { ClauseEditions, Edition } from "../../domain/rule-set/edition-types.ts";
import type { Equal } from "../engines/protocol/runner-module/type-equality.ts";
import { brandedTextSchema } from "./branded-schema.ts";

export const editionSchema = brandedTextSchema({
  text: z.string(),
  isBranded: isEdition,
  refusal: "not an edition: a whole number from 1, written as text",
});

export const FIRST_EDITION: Edition = editionSchema.parse("1");

export const clauseEditionsSchema = z
  .tuple([editionSchema], editionSchema)
  .default([FIRST_EDITION])
  .refine((editions) => editionOrder({ editions }) === "ascending", {
    error: "editions must be listed in ascending order, each once",
  })
  .transform(([first, ...later]): ClauseEditions => ({
    declared: [first, ...later],
    default: first,
    latest: later.at(-1) ?? first,
  }));

export const isEditionSchemaEqual: Equal<z.output<typeof editionSchema>, Edition> = true;
export const isClauseEditionsSchemaEqual: Equal<
  z.output<typeof clauseEditionsSchema>,
  ClauseEditions
> = true;
