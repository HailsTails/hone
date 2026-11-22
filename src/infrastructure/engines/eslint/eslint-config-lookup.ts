import { z } from "zod";

import type { EslintConfigLookup } from "../../../domain/settings/eslint-config-lookup.ts";
import type { Equal } from "../protocol/runner-module/type-equality.ts";

export const eslintConfigLookupSchema = z.enum(["nearest-to-file", "repository-root"]);

export const isEslintConfigLookupSchemaEqual: Equal<
  z.infer<typeof eslintConfigLookupSchema>,
  EslintConfigLookup
> = true;
