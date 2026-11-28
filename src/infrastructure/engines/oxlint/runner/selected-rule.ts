import { z } from "zod";

import { moduleFileForm } from "../../../../application/ports/host/module-extension.ts";
import { isRepoPath } from "../../../../domain/repository/repo-path.ts";
import type { Result } from "../../../../domain/result.ts";
import {
  type HoneCheckOptions,
  nonNullAssertionMessage,
} from "../../../../domain/rule-set/check-options.ts";
import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type { ReadonlyJsonValue } from "../../../../domain/settings/json-values/json-value.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import {
  optionsByEditionSchema,
  ruleOptionsOf,
  ruleOptionsSchema,
} from "../../protocol/plugin-settings/rule-options.ts";
import {
  typescriptEslintClassOptions,
  typescriptEslintNamingOptions,
} from "../../protocol/plugin-settings/typescript-eslint-options.ts";

const createArguments = (options: HoneCheckOptions): readonly ReadonlyJsonValue[] => {
  switch (options.kind) {
    case "parameter-count":
      return [{ max: options.maximumSlots, countVoidThis: options.voidReceiver === "count" }];
    case "parameter-reassignment":
      return [{ props: options.assignments === "binding-and-properties" }];
    case "static-members-only":
      return typescriptEslintClassOptions(options);
    case "naming-convention":
      return typescriptEslintNamingOptions(options);
    case "non-null-assertions":
      return options.rejects.map((assertion) => ({
        selector: assertion === "asserted-value" ? "TSNonNullExpression" : "[definite=true]",
        message: nonNullAssertionMessage[assertion],
      }));
    case "skipped-tests":
      return options.coverage === "including-conditional-and-todo" ? ["conditional-and-todo"] : [];
  }
};

const OXLINT_RULES = [
  "typescript/no-explicit-any",
  "eslint/max-params",
  "eslint/no-param-reassign",
] as const;

type OxlintRule = (typeof OXLINT_RULES)[number];

const optionFields = {
  options: ruleOptionsSchema.optional(),
  optionsByEdition: optionsByEditionSchema.optional(),
};

const settingsSchema = z.union([
  z.strictObject({ rule: z.enum(OXLINT_RULES), ...optionFields }),
  z.strictObject({
    pluginNamespace: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
    rule: z.string().min(1),
    module: z
      .string()
      .refine((module) => isRepoPath(module) && moduleFileForm({ text: module }) === "module-file"),
    peer: z.literal("typescript-eslint").optional(),
    ...optionFields,
  }),
]);

const path = createDefaultPathPort({});

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

export const readRule = (request: {
  readonly binding: CheckBinding;
}): Result<SelectedOxlintRule, RunnerFailure> => {
  const { binding } = request;
  if (binding.engine !== "oxlint") {
    return createPieceFailure({ pieceRoot: binding.pieceRoot, detail: "Expected an Oxlint check" });
  }
  const parsed = settingsSchema.safeParse(binding.settings);
  if (!parsed.success) {
    return createPieceFailure({
      pieceRoot: binding.pieceRoot,
      detail: z.prettifyError(parsed.error),
    });
  }
  const settings = parsed.data;
  const { checkOptions } = binding;
  const options =
    checkOptions.kind === "none"
      ? []
      : checkOptions.kind === "piece"
        ? ruleOptionsOf({ settings, edition: binding.edition })
        : createArguments(checkOptions);
  if (!("pluginNamespace" in settings)) {
    return { outcome: "ok", value: { kind: "native", id: settings.rule, options } };
  }
  if (binding.ruleSet !== TOOL_RULE_SET) {
    return createPieceFailure({
      pieceRoot: binding.pieceRoot,
      detail: "Expected a built-in Hone check",
    });
  }
  if (
    settings.rule === "naming-convention" &&
    options.some((option) => typeof option === "object" && option !== null && "types" in option)
  ) {
    return createPieceFailure({
      pieceRoot: binding.pieceRoot,
      detail: "Oxlint naming rules require options without type filters",
    });
  }
  const namespace = settings.pluginNamespace;
  return {
    outcome: "ok",
    value: {
      kind: "plugin",
      namespace,
      id: `${namespace}/${settings.rule}`,
      module: path.join({ segments: [binding.pieceRoot, settings.module] }),
      ...(settings.peer === undefined ? {} : { peerFolder: binding.pieceRoot }),
      options,
    },
  };
};
