import { z } from "zod";

import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import { gatheredOutcomes } from "../../../../../domain/gathered-outcomes.ts";
import type { AddressedCheck } from "../../../../../domain/language-layer/check-address-text.ts";
import {
  qualifiedAddressOf,
  qualifiedCheckAddressOf,
} from "../../../../../domain/language-layer/check-address.ts";
import type { CheckAddress } from "../../../../../domain/language-layer/symptom-catalogue.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import type { CheckBinding, LintCheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import { eslintPieceSettingsSchema } from "../../../protocol/plugin-settings/eslint-piece-settings-schema.ts";
import {
  CHECKS_PLUGIN_NAMESPACE,
  checkRuleIdOf,
  ESLINT_MECHANISM,
  type RuledCheck,
  runsOnEslint,
} from "../hone-plugin/check-rule-id.ts";
import { readEslintCheckOptions } from "../pieces/check-options.ts";
import type { ProjectedCheck } from "./checks-projection.ts";
import type { CoreInstall } from "./core-install.ts";
import { type PluginImport, pluginImportOf } from "./projection.ts";

export type ProjectionFailure =
  | Extract<PieceFailure, { readonly kind: "piece-invalid" }>
  | { readonly kind: "check-unknown"; readonly address: string };

const PLUGIN_EXPORT = "eslint-plugin";

const PLUGIN_SOURCE = "src/eslint-plugin.ts";

const projectedRuleOf = (request: {
  readonly check: AddressedCheck;
  readonly ruleSet: CheckBinding["ruleSet"];
  readonly settings: z.output<typeof eslintPieceSettingsSchema>;
  readonly edition: CheckBinding["edition"];
  readonly checkOptions: LintCheckBinding["checkOptions"];
}): ProjectedCheck => ({
  ruleSet: request.ruleSet,
  symptom: request.check.symptom.name,
  check: request.check.name,
  ruleId: checkRuleIdOf({ check: request.check }),
  options: readEslintCheckOptions(request),
});

export const projectedNamedChecksOf = (request: {
  readonly checks: readonly (CheckAddress & Pick<RuledCheck, "engines">)[];
  readonly bindings: readonly CheckBinding[];
}): Result<readonly ProjectedCheck[], ProjectionFailure> => {
  const registered = new Map(
    request.checks
      .filter((check) => runsOnEslint({ check }) === "eslint")
      .map((check) => [qualifiedCheckAddressOf({ check }), check]),
  );
  return gatheredOutcomes({
    outcomes: request.bindings
      .filter((binding): binding is LintCheckBinding => binding.engine === ESLINT_MECHANISM)
      .map((binding): Result<readonly ProjectedCheck[], ProjectionFailure> => {
        const settings = eslintPieceSettingsSchema.safeParse(binding.settings);
        if (!settings.success) {
          return {
            outcome: "failed",
            error: {
              kind: "piece-invalid",
              pieceRoot: binding.pieceRoot,
              detail: z.prettifyError(settings.error),
            },
          };
        }
        const check = registered.get(
          qualifiedAddressOf({ ruleSet: binding.ruleSet, address: binding.address }),
        );
        if (check === undefined) {
          return { outcome: "failed", error: { kind: "check-unknown", address: binding.address } };
        }
        const projected = projectedRuleOf({
          check,
          ruleSet: binding.ruleSet,
          settings: settings.data,
          edition: binding.edition,
          checkOptions: binding.checkOptions,
        });
        if (binding.ruleSet === TOOL_RULE_SET) return { outcome: "ok", value: [projected] };
        const { pluginNamespace, pluginModule, rule } = settings.data;
        if (pluginNamespace === CHECKS_PLUGIN_NAMESPACE) {
          return {
            outcome: "failed",
            error: {
              kind: "piece-invalid",
              pieceRoot: binding.pieceRoot,
              detail: `the plugin namespace ${pluginNamespace} is reserved for Hone's own rules`,
            },
          };
        }
        return {
          outcome: "ok",
          value: [
            {
              ...projected,
              ruleId: `${pluginNamespace}/${rule}`,
              plugin: {
                namespace: pluginNamespace,
                module: pluginModule,
                pieceRoot: binding.pieceRoot,
              },
            },
          ],
        };
      }),
  });
};

export const checksPluginImportOf = (request: {
  readonly path: PathPort;
  readonly importingDirectory: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly install: CoreInstall;
}): PluginImport =>
  request.install.form === "package"
    ? { placement: "importable", specifier: `${request.install.name}/${PLUGIN_EXPORT}` }
    : pluginImportOf({ ...request, pieceRoot: request.installRoot, pluginModule: PLUGIN_SOURCE });
