import { z } from "zod";

import { moduleExtensionOf } from "../../../../application/ports/host/module-extension.ts";
import { checkNamesOf } from "../../../../domain/language-layer/check-address-text.ts";
import type { Result } from "../../../../domain/result.ts";
import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import {
  OXLINT_RULES,
  type OxlintRule,
  type OxlintPluginRule,
} from "../../../node/process/oxlint-port.ts";
import { readNamedPiece } from "../../named-piece.ts";
import {
  eslintPieceSettingsSchema,
  ruleOptionsOf,
} from "../../protocol/plugin-settings/eslint-piece-settings-schema.ts";

const settingsSchema = z.union([
  z.strictObject({ rule: z.enum(OXLINT_RULES) }),
  z.strictObject({
    plugin: z.literal("eslint"),
    adapter: z.literal("naming-convention").optional(),
  }),
]);

const path = createDefaultPathPort({});
const fileText = createDefaultFileTextPort({});

const invalidPiece = (request: {
  readonly pieceRoot: string;
  readonly detail: string;
}): Result<never, RunnerFailure> => ({
  outcome: "failed",
  error: { kind: "piece-invalid", ...request },
});

export type SelectedOxlintRule =
  | { readonly kind: "native"; readonly id: OxlintRule }
  | (OxlintPluginRule & { readonly kind: "plugin" });

type PluginSettings = Extract<z.output<typeof settingsSchema>, { readonly plugin: "eslint" }>;

const pluginModule = (request: {
  readonly installRoot: string;
  readonly pieceRoot: string;
  readonly module: string;
  readonly adapter: PluginSettings["adapter"];
}): string =>
  path.join({
    segments:
      request.adapter === undefined
        ? [request.pieceRoot, request.module]
        : [
            request.installRoot,
            "src",
            "infrastructure",
            "engines",
            "eslint",
            "runner",
            `oxlint-naming-plugin${moduleExtensionOf({ moduleUrl: import.meta.url })}`,
          ],
  });

const readPluginRule = (request: {
  readonly installRoot: string;
  readonly binding: CheckBinding;
  readonly settings: PluginSettings;
}): Result<SelectedOxlintRule, RunnerFailure> => {
  const { binding, installRoot, settings } = request;
  const names = checkNamesOf({ text: binding.address });
  if (binding.ruleSet !== TOOL_RULE_SET || names === undefined) {
    return invalidPiece({ pieceRoot: binding.pieceRoot, detail: "Expected a built-in Hone check" });
  }
  const piece = readNamedPiece({
    ...names,
    fileText,
    path,
    installRoot,
    ruleSetRoot: installRoot,
    mechanism: "eslint",
  });
  if (piece.outcome === "failed") {
    return invalidPiece({
      pieceRoot: binding.pieceRoot,
      detail: `Cannot read the matching ESLint piece: ${piece.error.kind}`,
    });
  }
  const configured = eslintPieceSettingsSchema.safeParse(piece.value.settings);
  if (!configured.success) {
    return invalidPiece({
      pieceRoot: piece.value.pieceRoot,
      detail: z.prettifyError(configured.error),
    });
  }
  const { adapter } = settings;
  const options = ruleOptionsOf({ settings: configured.data, edition: binding.edition });
  if (
    adapter !== undefined &&
    (configured.data.rule !== "naming-convention" ||
      options.some((option) => typeof option === "object" && option !== null && "types" in option))
  ) {
    return invalidPiece({
      pieceRoot: binding.pieceRoot,
      detail: "Oxlint naming rules require options without type filters",
    });
  }
  const owner = piece.value.pieceRoot.replaceAll("\\", "/").split("/").slice(-2);
  const namespace = `hone-${owner.join("-")}`;
  return {
    outcome: "ok",
    value: {
      kind: "plugin",
      namespace,
      id: `${namespace}/${configured.data.rule}`,
      module: pluginModule({
        installRoot,
        pieceRoot: piece.value.pieceRoot,
        module: configured.data.pluginModule,
        adapter,
      }),
      options,
    },
  };
};

export const readRule = (request: {
  readonly installRoot: string;
  readonly binding: CheckBinding;
}): Result<SelectedOxlintRule, RunnerFailure> => {
  const settings = settingsSchema.safeParse(request.binding.settings);
  if (!settings.success) {
    return invalidPiece({
      pieceRoot: request.binding.pieceRoot,
      detail: z.prettifyError(settings.error),
    });
  }
  return "rule" in settings.data
    ? { outcome: "ok", value: { kind: "native", id: settings.data.rule } }
    : readPluginRule({ ...request, settings: settings.data });
};
