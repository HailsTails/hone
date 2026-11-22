import { z } from "zod";
import { isAbsolutePath } from "../../domain/repository/absolute-path.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Equal } from "../engines/protocol/runner-module/type-equality.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";

export const absolutePathSchema = z.string().transform((text, context): AbsolutePath => {
  if (isAbsolutePath(text)) {
    return absoluteRootOf(text);
  }
  context.addIssue({ code: "custom", message: "not an absolute path" });
  return z.NEVER;
});

export const isAbsolutePathSchemaEqual: Equal<z.output<typeof absolutePathSchema>, AbsolutePath> = true;
