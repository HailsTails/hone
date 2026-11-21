import { z } from "zod";
import { moduleFileForm } from "../../../../node/modules/install-layout.ts";
import { isRepoPathText } from "../../../../../domain/repository/repo-path.ts";
import type { Equal } from "../../../protocol/runner-module/type-equality.ts";
import type { EslintPieceSettings, RuleOptions } from "./eslint-piece-settings-types.ts";

export type { EslintPieceSettings, RuleOptions } from "./eslint-piece-settings-types.ts";

const pieceModulePathSchema = z.string().superRefine((text, context) => {
  if (isRepoPathText({ text }) === "not-repo-path" || moduleFileForm({ text }) === "not-module-file") {
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
    options: z.array(z.json()).readonly().optional(),
  })
  .readonly();

export const isEslintPieceSettingsSchemaEqual: Equal<z.output<typeof eslintPieceSettingsSchema>, EslintPieceSettings> = true;

export const ruleOptionsOf = (request: { readonly settings: EslintPieceSettings }): RuleOptions =>
  request.settings.options ?? [];
