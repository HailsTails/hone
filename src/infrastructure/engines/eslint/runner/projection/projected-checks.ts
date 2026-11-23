import { z } from "zod";

import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import { gatheredOutcomes } from "../../../../../domain/gathered-outcomes.ts";
import {
  type AddressedCheck,
  checkAddressTextOf,
} from "../../../../../domain/language-layer/check-address-text.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import {
  CHECKS_PLUGIN_NAMESPACE,
  checkRuleIdOf,
  ESLINT_MECHANISM,
  type RuledCheck,
  runsOnEslint,
} from "../hone-plugin/check-rule-id.ts";
import {
  eslintPieceSettingsSchema,
  ruleOptionsOf,
} from "../pieces/eslint-piece-settings-schema.ts";
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
}): ProjectedCheck => ({
  ruleSet: request.ruleSet,
  symptom: request.check.symptom.name,
  check: request.check.name,
  ruleId: checkRuleIdOf({ check: request.check }),
  options: ruleOptionsOf({ settings: request.settings }),
});

export const projectedNamedChecksOf = (request: {
  readonly checks: readonly (AddressedCheck & Pick<RuledCheck, "engines">)[];
  readonly bindings: readonly CheckBinding[];
}): Result<readonly ProjectedCheck[], ProjectionFailure> => {
  const registered = new Map(
    request.checks
      .filter((check) => runsOnEslint({ check }) === "eslint")
      .map((check) => [checkAddressTextOf({ check }), check]),
  );
  return gatheredOutcomes({
    outcomes: request.bindings
      .filter(({ engine }) => engine === ESLINT_MECHANISM)
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
        const check = registered.get(binding.address);
        if (check === undefined) {
          return { outcome: "failed", error: { kind: "check-unknown", address: binding.address } };
        }
        const projected = projectedRuleOf({
          check,
          ruleSet: binding.ruleSet,
          settings: settings.data,
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
