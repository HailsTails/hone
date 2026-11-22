import { z } from "zod";
import { isAbsolutePath } from "../../domain/repository/absolute-path.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { brandedTextSchema } from "./branded-schema.ts";
import type { Equal } from "../engines/protocol/runner-module/type-equality.ts";

export const absolutePathSchema = brandedTextSchema({
  text: z.string(),
  isBranded: isAbsolutePath,
  refusal: "not an absolute path",
});

export const isAbsolutePathSchemaEqual: Equal<z.output<typeof absolutePathSchema>, AbsolutePath> = true;
