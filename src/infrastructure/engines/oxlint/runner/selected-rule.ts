import { z } from "zod";

import { moduleFileForm } from "../../../../application/ports/host/module-extension.ts";
import { checkNamesOf } from "../../../../domain/language-layer/check-address-text.ts";
import { isRepoPath } from "../../../../domain/repository/repo-path.ts";
import type { Result } from "../../../../domain/result.ts";
import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type { ReadonlyJsonValue } from "../../../../domain/settings/json-values/json-value.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import { readNamedPiece } from "../../named-piece.ts";
import {
  eslintPieceSettingsSchema,
  ruleOptionsOf,
} from "../../protocol/plugin-settings/eslint-piece-settings-schema.ts";

const OXLINT_RULES = [
  "typescript/no-explicit-any",
  "eslint/max-params",
  "eslint/no-param-reassign",
] as const;

type OxlintRule = (typeof OXLINT_RULES)[number];

const settingsSchema = z.union([
  z.strictObject({ rule: z.enum(OXLINT_RULES) }),
  z.strictObject({
    plugin: z.literal("eslint"),
    module: z
      .string()
      .refine((module) => isRepoPath(module) && moduleFileForm({ text: module }) === "module-file")
      .optional(),
  }),
]);

const path = createDefaultPathPort({});
const fileText = createDefaultFileTextPort({});

const createPieceFailure = (request: {
  readonly pieceRoot: string;
  readonly detail: string;
}): Result<never, RunnerFailure> => ({
  outcome: "failed",
  error: { kind: "piece-invalid", ...request },
});

export type SelectedOxlintRule =
  | {
      readonly kind: "native";
      readonly id: OxlintRule;
      readonly options: readonly ReadonlyJsonValue[];
    }
  | {
      readonly kind: "plugin";
      readonly namespace: string;
      readonly peerFolder?: string;
      readonly id: string;
      readonly module: string;
      readonly options: readonly ReadonlyJsonValue[];
    };

export const listPeerFolders = (rules: readonly SelectedOxlintRule[]): readonly string[] =>
  rules.flatMap((rule) =>
    rule.kind === "plugin" && rule.peerFolder !== undefined ? [rule.peerFolder] : [],
  );

type PluginSettings = Extract<z.output<typeof settingsSchema>, { readonly plugin: "eslint" }>;

const NATIVE_CHECKS: Readonly<Record<OxlintRule, string>> = {
  "typescript/no-explicit-any": "untyped-value#explicit-any",
  "eslint/max-params": "positional-parameters#parameter-count",
  "eslint/no-param-reassign": "rebinding#parameter-reassignment",
};

const readEslintRule = (request: {
  readonly address: string;
  readonly installRoot: string;
  readonly binding: CheckBinding;
}) => {
  const { binding, installRoot } = request;
  const names = checkNamesOf({ text: request.address });
  if (names === undefined) {
    return createPieceFailure({
      pieceRoot: binding.pieceRoot,
      detail: "Expected a built-in Hone check",
    });
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
    return createPieceFailure({
      pieceRoot: binding.pieceRoot,
      detail: `Cannot read the matching ESLint piece: ${piece.error.kind}`,
    });
  }
  const parsed = eslintPieceSettingsSchema.safeParse(piece.value.settings);
  return parsed.success
    ? { outcome: "ok" as const, value: { settings: parsed.data, pieceRoot: piece.value.pieceRoot } }
    : createPieceFailure({
        pieceRoot: piece.value.pieceRoot,
        detail: z.prettifyError(parsed.error),
      });
};

const readNativeRule = (request: {
  readonly id: OxlintRule;
  readonly installRoot: string;
  readonly binding: CheckBinding;
}): Result<SelectedOxlintRule, RunnerFailure> => {
  const rule = readEslintRule({ ...request, address: NATIVE_CHECKS[request.id] });
  if (rule.outcome === "failed") return rule;
  const options = ruleOptionsOf({
    settings: rule.value.settings,
    edition: request.binding.edition,
  });
  return { outcome: "ok", value: { kind: "native", id: request.id, options } };
};

const PEER_RULES: ReadonlySet<string> = new Set([
  "no-class-authoring",
  "no-extraneous-class",
  "no-restricted-syntax",
  "naming-convention",
  "implicit-any-let",
]);

const readPluginRule = (request: {
  readonly installRoot: string;
  readonly binding: CheckBinding;
  readonly settings: PluginSettings;
}): Result<SelectedOxlintRule, RunnerFailure> => {
  const { binding, settings } = request;
  if (binding.ruleSet !== TOOL_RULE_SET) {
    return createPieceFailure({
      pieceRoot: binding.pieceRoot,
      detail: "Expected a built-in Hone check",
    });
  }
  const rule = readEslintRule({ ...request, address: binding.address });
  if (rule.outcome === "failed") return rule;
  const { pieceRoot, settings: configured } = rule.value;
  const options = ruleOptionsOf({ settings: configured, edition: binding.edition });
  if (
    settings.module !== undefined &&
    options.some((option) => typeof option === "object" && option !== null && "types" in option)
  ) {
    return createPieceFailure({
      pieceRoot: binding.pieceRoot,
      detail: "Oxlint naming rules require options without type filters",
    });
  }
  const owner = pieceRoot.replaceAll("\\", "/").split("/").slice(-2);
  const namespace = `hone-${owner.join("-")}`;
  return {
    outcome: "ok",
    value: {
      kind: "plugin",
      namespace,
      id: `${namespace}/${configured.rule}`,
      module: path.join({
        segments:
          settings.module === undefined
            ? [pieceRoot, configured.pluginModule]
            : [binding.pieceRoot, settings.module],
      }),
      ...(PEER_RULES.has(configured.rule) ? { peerFolder: pieceRoot } : {}),
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
    return createPieceFailure({
      pieceRoot: request.binding.pieceRoot,
      detail: z.prettifyError(settings.error),
    });
  }
  return "rule" in settings.data
    ? readNativeRule({ ...request, id: settings.data.rule })
    : readPluginRule({ ...request, settings: settings.data });
};
