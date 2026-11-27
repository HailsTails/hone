import type { RuleTester } from "oxlint/plugins-dev";

import { readTypescriptEslintRule } from "../../runner/typescript-eslint-rule.ts";

const rule = await readTypescriptEslintRule({ name: "naming-convention" });

type OxlintRule = Parameters<RuleTester["run"]>[1];
type NamingContext = Parameters<NonNullable<OxlintRule["create"]>>[0];

export default {
  meta: { name: "hone-oxlint-naming", version: "0.0.0-local" },
  rules: {
    "naming-convention": {
      ...rule,
      create: (context: NamingContext) => {
        const parserServices = {
          esTreeNodeToTSNodeMap: new WeakMap<object, object>(),
          tsNodeToESTreeNodeMap: new WeakMap<object, object>(),
        };
        const sourceCode = { parserServices };
        Object.setPrototypeOf(sourceCode, context.sourceCode);
        const ruleContext = { sourceCode };
        Object.setPrototypeOf(ruleContext, context);
        return rule.create(ruleContext);
      },
    },
  },
};
