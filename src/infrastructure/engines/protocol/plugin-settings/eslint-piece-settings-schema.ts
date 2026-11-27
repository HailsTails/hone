import { z } from "zod";

import { moduleFileForm } from "../../../../application/ports/host/module-extension.ts";
import { isRepoPathText } from "../../../../domain/repository/repo-path.ts";
import type { Equal } from "../runner-module/type-equality.ts";
import type { EslintPieceSettings } from "./eslint-piece-settings-types.ts";
import { optionsByEditionSchema, ruleOptionsSchema } from "./rule-options.ts";

export type { EslintPieceSettings } from "./eslint-piece-settings-types.ts";

const pieceModulePathSchema = z.string().superRefine((text, context) => {
  if (
    isRepoPathText({ text }) === "not-repo-path" ||
    moduleFileForm({ text }) === "not-module-file"
  ) {
    context.addIssue({
      code: "custom",
      message: "not a path inside the piece folder ending in .ts, or .js in a built install",
    });
  }
});

const pluginNamespaceSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
export const eslintPieceSettingsSchema = z
  .strictObject({
    pluginNamespace: pluginNamespaceSchema,
    pluginModule: pieceModulePathSchema,
    rule: z.string(),
    options: ruleOptionsSchema.optional(),
    optionsByEdition: optionsByEditionSchema.optional(),
  })
  .readonly();

export const isEslintPieceSettingsSchemaEqual: Equal<
  z.output<typeof eslintPieceSettingsSchema>,
  EslintPieceSettings
> = true;
