import { z } from "zod";

import type { Result } from "../../../../../domain/result.ts";
import { TOOL_IDENTITY } from "../../../../../domain/rule-set/tool-identity.ts";
import { everyOk } from "../../../../../domain/settings/every-ok.ts";
import {
  eslintPluginModuleSchema,
  type LoadedEslintPlugin,
} from "../pieces/eslint-plugin-schema.ts";
import type { Rule } from "../toolchain/eslint-instance.ts";
import type { EslintMajorBoundary } from "../toolchain/eslint-major-boundary.ts";
import { checkRuleNameOf, type PluginCheck } from "./check-rule-id.ts";

export type PieceSource = {
  readonly check: PluginCheck;
  readonly pieceFile: string;
  readonly pluginModule: string;
  readonly ruleName: string;
  readonly plugin: unknown;
};

export type ChecksPlugin = {
  readonly meta: { readonly name: string; readonly version: string };
  readonly rules: Readonly<Record<string, Rule.RuleModule>>;
};

export type ChecksPluginFailure =
  | { readonly kind: "piece-source-invalid"; readonly pieceFile: string; readonly detail: string }
  | {
      readonly kind: "plugin-invalid";
      readonly pieceFile: string;
      readonly pluginModule: string;
      readonly detail: string;
    }
  | { readonly kind: "piece-rule-missing"; readonly pieceFile: string; readonly rule: string }
  | { readonly kind: "check-rule-missing"; readonly ruleId: string };

type PieceRule = LoadedEslintPlugin["rules"][string];

type Built<Value> = Result<Value, ChecksPluginFailure>;

const PLUGIN_META = { name: `${TOOL_IDENTITY.packageName}/eslint-plugin`, version: "0.0.0-local" };

const NUMBERED_LEAD = /^CD-\d+: /;

export const inSymptomWords = (request: {
  readonly message: string;
  readonly title: string;
}): string => `${request.title}: ${request.message.replace(NUMBERED_LEAD, "")}`;

const unnumbered = (request: {
  readonly text: string | number | boolean | bigint | null | undefined;
}) => (typeof request.text === "string" ? request.text.replace(NUMBERED_LEAD, "") : request.text);

export const reportInSymptomWords = (request: {
  readonly descriptor: Rule.ReportDescriptor;
  readonly boundary: EslintMajorBoundary;
}): Rule.ReportDescriptor => {
  const reportData = request.boundary.reportDataOf({ descriptor: request.descriptor });
  return reportData === undefined
    ? request.descriptor
    : {
        ...request.descriptor,
        data: Object.fromEntries(
          Object.entries(reportData).map(([key, text]) => [key, unnumbered({ text })]),
        ),
      };
};

const contextInSymptomWords = (request: {
  readonly context: Rule.RuleContext;
  readonly boundary: EslintMajorBoundary;
}): Rule.RuleContext =>
  Object.create(request.context, {
    report: {
      value: (descriptor: Rule.ReportDescriptor) =>
        request.context.report(reportInSymptomWords({ descriptor, boundary: request.boundary })),
    },
  });

const messagesInSymptomWords = (request: {
  readonly messages: Readonly<Record<string, string>> | undefined;
  readonly title: string;
}) =>
  request.messages === undefined
    ? undefined
    : Object.fromEntries(
        Object.entries(request.messages).map(([messageId, message]) => [
          messageId,
          inSymptomWords({ message, title: request.title }),
        ]),
      );

const checkRuleOf = (request: {
  readonly rule: PieceRule;
  readonly title: string;
  readonly boundary: EslintMajorBoundary;
}): Rule.RuleModule => ({
  meta: {
    ...request.rule.meta,
    messages: messagesInSymptomWords({
      messages: request.rule.meta.messages,
      title: request.title,
    }),
  },
  create: (context) =>
    request.rule.create(contextInSymptomWords({ context, boundary: request.boundary })),
});

const namedRuleOf = (request: {
  readonly source: PieceSource;
  readonly boundary: EslintMajorBoundary;
}): Built<readonly [string, Rule.RuleModule]> => {
  const { check, pieceFile, pluginModule, ruleName } = request.source;
  const plugin = eslintPluginModuleSchema.safeParse({ default: request.source.plugin });
  if (!plugin.success) {
    return {
      outcome: "failed",
      error: {
        kind: "plugin-invalid",
        pieceFile,
        pluginModule,
        detail: z.prettifyError(plugin.error),
      },
    };
  }
  const { rules } = plugin.data.default;
  const rule = Object.hasOwn(rules, ruleName) ? rules[ruleName] : undefined;
  return rule === undefined
    ? { outcome: "failed", error: { kind: "piece-rule-missing", pieceFile, rule: ruleName } }
    : {
        outcome: "ok",
        value: [
          checkRuleNameOf({ check }),
          checkRuleOf({ rule, title: check.symptom.title, boundary: request.boundary }),
        ],
      };
};

export const checksPluginOf = (request: {
  readonly sources: readonly PieceSource[];
  readonly boundary: EslintMajorBoundary;
}): Built<ChecksPlugin> => {
  const rules = everyOk({
    entries: request.sources,
    resolve: (source) => namedRuleOf({ source, boundary: request.boundary }),
  });
  return rules.outcome === "failed"
    ? rules
    : { outcome: "ok", value: { meta: PLUGIN_META, rules: Object.fromEntries(rules.value) } };
};
