import { eslintPluginModuleSchema } from "./pieces/eslint-plugin-schema.ts";
import { defaultNativeRuleSources, typescriptEslintRules } from "./pieces/native-rules.ts";
import type { TypescriptEslintRule } from "./toolchain/eslint-toolchain.ts";

type RuleContext = Parameters<TypescriptEslintRule["create"]>[0];

const rules = typescriptEslintRules({
  names: ["naming-convention"],
  sources: defaultNativeRuleSources,
});
const rule = eslintPluginModuleSchema.parse({ default: { rules } }).default.rules[
  "naming-convention"
];

export default {
  meta: { name: "hone-oxlint-naming", version: "0.0.0-local" },
  rules: {
    "naming-convention": {
      ...rule,
      create: (context: RuleContext) => {
        const parserServices = {
          esTreeNodeToTSNodeMap: new WeakMap(),
          tsNodeToESTreeNodeMap: new WeakMap(),
        };
        const sourceCode = Object.setPrototypeOf({ parserServices }, context.sourceCode);
        return rule.create(Object.setPrototypeOf({ sourceCode }, context));
      },
    },
  },
};
