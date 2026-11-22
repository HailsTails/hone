import { z } from "zod";
import { gatheredOutcomes } from "../../../../../domain/gathered-outcomes.ts";
import type { Result } from "../../../../../domain/result.ts";
import { TOOL_IDENTITY } from "../../../../../domain/rule-set/tool-identity.ts";
import { checkRuleIdOf, checkRuleNameOf, type RuledCheck, runsOnEslint } from "./check-rule-id.ts";
import { eslintPieceSettingsSchema } from "../pieces/eslint-piece-settings-schema.ts";
import type { Rule } from "../toolchain/eslint-instance.ts";
import type { EslintMajorBoundary } from "../toolchain/eslint-major-boundary.ts";
import { eslintPluginModuleSchema, type LoadedEslintPlugin } from "../pieces/eslint-plugin-schema.ts";

export type PieceSource = { readonly pieceFile: string; readonly pluginModule: string; readonly piece: unknown; readonly plugin: unknown };

export type ChecksPlugin = {
  readonly meta: { readonly name: string; readonly version: string };
  readonly rules: Readonly<Record<string, Rule.RuleModule>>;
};

export type ChecksPluginFailure =
  | { readonly kind: "piece-source-invalid"; readonly pieceFile: string; readonly detail: string }
  | { readonly kind: "plugin-invalid"; readonly pieceFile: string; readonly pluginModule: string; readonly detail: string }
  | { readonly kind: "piece-rule-missing"; readonly pieceFile: string; readonly rule: string }
  | { readonly kind: "check-rule-missing"; readonly ruleId: string };

type PieceRule = LoadedEslintPlugin["rules"][string];

type ClauseRule = { readonly discipline: string; readonly clause: string; readonly rule: PieceRule };

type Built<Value> = Result<Value, ChecksPluginFailure>;

const PLUGIN_META = { name: `${TOOL_IDENTITY.packageName}/eslint-plugin`, version: "0.0.0-local" };

const NUMBERED_LEAD = /^CD-\d+: /;

const pieceSchema = z.looseObject({
  discipline: z.string(),
  clauses: z.array(z.looseObject({ clause: z.string(), settings: eslintPieceSettingsSchema })),
});

type PieceClause = z.infer<typeof pieceSchema>["clauses"][number];

export const inSymptomWords = (request: { readonly message: string; readonly title: string }): string =>
  `${request.title}: ${request.message.replace(NUMBERED_LEAD, "")}`;

const unnumbered = (request: { readonly text: string | number | boolean | bigint | null | undefined }) =>
  typeof request.text === "string" ? request.text.replace(NUMBERED_LEAD, "") : request.text;

export const reportInSymptomWords = (request: {
  readonly descriptor: Rule.ReportDescriptor;
  readonly boundary: EslintMajorBoundary;
}): Rule.ReportDescriptor => {
  const reportData = request.boundary.reportDataOf({ descriptor: request.descriptor });
  return reportData === undefined
    ? request.descriptor
    : {
        ...request.descriptor,
        data: Object.fromEntries(Object.entries(reportData).map(([key, text]) => [key, unnumbered({ text })])),
      };
};

const contextInSymptomWords = (request: { readonly context: Rule.RuleContext; readonly boundary: EslintMajorBoundary }): Rule.RuleContext =>
  Object.create(request.context, {
    report: {
      value: (descriptor: Rule.ReportDescriptor) =>
        request.context.report(reportInSymptomWords({ descriptor, boundary: request.boundary })),
    },
  });

const messagesInSymptomWords = (request: { readonly messages: Readonly<Record<string, string>> | undefined; readonly title: string }) =>
  request.messages === undefined
    ? undefined
    : Object.fromEntries(Object.entries(request.messages).map(([messageId, message]) => [messageId, inSymptomWords({ message, title: request.title })]));

const checkRuleOf = (request: {
  readonly rule: PieceRule;
  readonly title: string;
  readonly boundary: EslintMajorBoundary;
}): Rule.RuleModule => ({
  meta: { ...request.rule.meta, messages: messagesInSymptomWords({ messages: request.rule.meta.messages, title: request.title }) },
  create: (context) => request.rule.create(contextInSymptomWords({ context, boundary: request.boundary })),
});

const clauseRuleOf = (request: {
  readonly source: PieceSource;
  readonly discipline: string;
  readonly entry: PieceClause;
  readonly rules: LoadedEslintPlugin["rules"];
}): Built<readonly ClauseRule[]> => {
  const rule = Object.hasOwn(request.rules, request.entry.settings.rule) ? request.rules[request.entry.settings.rule] : undefined;
  return rule === undefined
    ? { outcome: "failed", error: { kind: "piece-rule-missing", pieceFile: request.source.pieceFile, rule: request.entry.settings.rule } }
    : { outcome: "ok", value: [{ discipline: request.discipline, clause: request.entry.clause, rule }] };
};

const clauseRulesOf = (request: { readonly source: PieceSource }): Built<readonly ClauseRule[]> => {
  const piece = pieceSchema.safeParse(request.source.piece);
  if (!piece.success) {
    return { outcome: "failed", error: { kind: "piece-source-invalid", pieceFile: request.source.pieceFile, detail: z.prettifyError(piece.error) } };
  }
  const plugin = eslintPluginModuleSchema.safeParse({ default: request.source.plugin });
  if (!plugin.success) {
    return {
      outcome: "failed",
      error: { kind: "plugin-invalid", pieceFile: request.source.pieceFile, pluginModule: request.source.pluginModule, detail: z.prettifyError(plugin.error) },
    };
  }
  return gatheredOutcomes({
    outcomes: piece.data.clauses
      .filter((entry) => entry.settings.pluginModule === request.source.pluginModule)
      .map((entry) => clauseRuleOf({ source: request.source, discipline: piece.data.discipline, entry, rules: plugin.data.default.rules })),
  });
};

const namedRuleOf = (request: {
  readonly check: RuledCheck;
  readonly clauseRules: readonly ClauseRule[];
  readonly boundary: EslintMajorBoundary;
}): Built<readonly (readonly [string, Rule.RuleModule])[]> => {
  const clauseRule = request.clauseRules.find(
    (candidate) =>
      request.check.clause.ruleSet === TOOL_IDENTITY.ownRuleSet &&
      "discipline" in request.check.clause &&
      request.check.clause.discipline === candidate.discipline &&
      request.check.clause.clause === candidate.clause,
  );
  return clauseRule === undefined
    ? { outcome: "failed", error: { kind: "check-rule-missing", ruleId: checkRuleIdOf({ check: request.check }) } }
    : { outcome: "ok", value: [[checkRuleNameOf({ check: request.check }), checkRuleOf({ rule: clauseRule.rule, title: request.check.symptom.title, boundary: request.boundary })]] };
};

export const checksPluginOf = (request: {
  readonly checks: readonly RuledCheck[];
  readonly sources: readonly PieceSource[];
  readonly boundary: EslintMajorBoundary;
}): Built<ChecksPlugin> => {
  const clauseRules = gatheredOutcomes({ outcomes: request.sources.map((source) => clauseRulesOf({ source })) });
  if (clauseRules.outcome === "failed") {
    return clauseRules;
  }
  const rules = gatheredOutcomes({
    outcomes: request.checks.filter((check) => runsOnEslint({ check }) === "eslint").map((check) => namedRuleOf({ check, clauseRules: clauseRules.value, boundary: request.boundary })),
  });
  return rules.outcome === "failed" ? rules : { outcome: "ok", value: { meta: PLUGIN_META, rules: Object.fromEntries(rules.value) } };
};
