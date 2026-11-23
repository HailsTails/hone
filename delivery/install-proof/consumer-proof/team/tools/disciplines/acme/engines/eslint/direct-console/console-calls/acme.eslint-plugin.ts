import type { ESLint, Rule } from "eslint";

export const noConsoleCalls: Rule.RuleModule = {
  meta: {
    type: "problem",
    schema: [],
    messages: { console: "Write through the logger port, not console." },
  },
  create: (context) => ({
    "MemberExpression[object.name='console']": (node: Rule.Node) => {
      context.report({ node, messageId: "console" });
    },
  }),
};

const plugin: ESLint.Plugin = { rules: { "no-console-calls": noConsoleCalls } };

export default plugin;
