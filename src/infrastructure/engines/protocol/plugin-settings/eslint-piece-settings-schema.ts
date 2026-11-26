import { z } from "zod";

import { moduleFileForm } from "../../../../application/ports/host/module-extension.ts";
import { isRepoPathText } from "../../../../domain/repository/repo-path.ts";
import { editionReaches } from "../../../../domain/rule-set/edition-reach.ts";
import type { Edition } from "../../../../domain/rule-set/edition-types.ts";
import { editionSchema } from "../../../content-files/edition.ts";
import type { Equal } from "../runner-module/type-equality.ts";
import type { EslintPieceSettings, RuleOptions } from "./eslint-piece-settings-types.ts";

export type { EslintPieceSettings, RuleOptions } from "./eslint-piece-settings-types.ts";

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
const ruleOptionsSchema = z.array(z.json()).readonly();
const optionsByEditionSchema = z
  .record(z.string(), ruleOptionsSchema)
  .transform((options) => new Map(Object.entries(options)))
  .pipe(z.map(editionSchema, ruleOptionsSchema))
  .readonly();

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

export const ruleOptionsOf = (request: {
  readonly settings: EslintPieceSettings;
  readonly edition: Edition;
}): RuleOptions => {
  const { settings, edition } = request;
  const reached = [...(settings.optionsByEdition ?? [])]
    .filter(([introducedIn]) => editionReaches({ edition, introducedIn }) === "reached")
    .reduce<readonly [Edition, RuleOptions] | undefined>((latest, candidate) => {
      if (latest === undefined) return candidate;
      return editionReaches({ edition: candidate[0], introducedIn: latest[0] }) === "reached"
        ? candidate
        : latest;
    }, undefined);
  return reached?.[1] ?? settings.options ?? [];
};
