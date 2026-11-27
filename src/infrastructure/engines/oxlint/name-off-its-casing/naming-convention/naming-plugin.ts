import { readNamingRule } from "../../runner/naming-rule.ts";

const rule = await readNamingRule({ moduleUrl: import.meta.url });

type NamingContext = { readonly sourceCode: object };

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
