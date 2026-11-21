import { z } from "zod";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import type { PathPort } from "../../../../node/path-port.ts";
import type { AbsolutePath } from "../../../../content-files/absolute-path.ts";
import { type ClauseAddress, clauseAddressText, sameClauseAddress, TOOL_RULE_SET } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { gatheredOutcomes } from "../../../../../domain/gathered-outcomes.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { CoreInstall } from "./core-install.ts";
import { eslintPieceSettingsSchema, ruleOptionsOf } from "../pieces/eslint-piece-settings-schema.ts";
import { type PluginImport, pluginImportOf } from "./projection.ts";
import { checkRuleIdOf, type RuledCheck, runsOnEslint } from "../hone-plugin/check-rule-id.ts";
import type { ProjectedCheck } from "./checks-projection.ts";

export type ProjectionFailure =
  | Extract<PieceFailure, { readonly kind: "piece-invalid" }>
  | { readonly kind: "check-unknown"; readonly address: string }
  | { readonly kind: "check-outside-rule-set"; readonly address: string };

export type ProjectedBinding = { readonly mechanism: string; readonly clause: { readonly address: ClauseAddress; readonly pieceRoot: string; readonly settings: unknown } };

const ESLINT_MECHANISM = "eslint";

const PLUGIN_EXPORT = "eslint-plugin";

const PLUGIN_SOURCE = "src/eslint-plugin.ts";

const projectedChecksOfBinding = (request: {
  readonly checks: readonly RuledCheck[];
  readonly binding: ProjectedBinding;
}): Result<readonly ProjectedCheck[], ProjectionFailure> => {
  const settings = eslintPieceSettingsSchema.safeParse(request.binding.clause.settings);
  if (!settings.success) {
    return { outcome: "failed", error: { kind: "piece-invalid", pieceRoot: request.binding.clause.pieceRoot, detail: z.prettifyError(settings.error) } };
  }
  const address = request.binding.clause.address;
  const checks = request.checks.filter(
    (check) => runsOnEslint({ check }) === "eslint" && sameClauseAddress({ left: check.clause, right: address }) === "same",
  );
  if (checks.length === 0) {
    return { outcome: "failed", error: { kind: "check-unknown", address: clauseAddressText({ address }) } };
  }
  if (address.ruleSet !== TOOL_RULE_SET) {
    return { outcome: "failed", error: { kind: "check-outside-rule-set", address: clauseAddressText({ address }) } };
  }
  return {
    outcome: "ok",
    value: checks.map((check) => ({ symptom: check.symptom.name, check: check.name, ruleId: checkRuleIdOf({ check }), options: ruleOptionsOf({ settings: settings.data }) })),
  };
};

export const projectedChecksOf = (request: {
  readonly checks: readonly RuledCheck[];
  readonly bindings: readonly ProjectedBinding[];
}): Result<readonly ProjectedCheck[], ProjectionFailure> => {
  const projected = gatheredOutcomes({
    outcomes: request.bindings
      .filter((binding) => binding.mechanism === ESLINT_MECHANISM)
      .map((binding) => projectedChecksOfBinding({ checks: request.checks, binding })),
  });
  return projected.outcome === "failed" ? projected : { outcome: "ok", value: projected.value.flat() };
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
