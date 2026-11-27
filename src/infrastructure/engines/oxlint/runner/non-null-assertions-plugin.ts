import { z } from "zod";

import type { RuleContext, SyntaxNode } from "../../protocol/plugin-rules/rule-sites.ts";

const restrictions = z.array(z.object({ selector: z.string().min(1), message: z.string().min(1) }));

const noRestrictedSyntax = {
  meta: { schema: z.toJSONSchema(restrictions, { target: "draft-07" }) },
  create: (context: RuleContext) =>
    Object.fromEntries(
      restrictions
        .parse(context.options)
        .map(({ selector, message }) => [
          selector,
          (node: SyntaxNode) => context.report({ node, message }),
        ]),
    ),
};

export default {
  meta: { name: "hone-non-null-assertions", version: "0.0.0-local" },
  rules: { "no-restricted-syntax": noRestrictedSyntax },
};
