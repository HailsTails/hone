import { z } from "zod";
import type { Anchor } from "../../../../domain/finding/anchor.ts";
import type { Equal } from "./type-equality.ts";

export const anchorSchema = z
  .object({
    line: z.number().int().min(1),
    column: z.number().int().min(0),
  })
  .readonly();

export const isAnchorSchemaEqual: Equal<z.output<typeof anchorSchema>, Anchor> = true;
