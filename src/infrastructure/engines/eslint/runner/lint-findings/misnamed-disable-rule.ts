import { z } from "zod";

import { TOOL_IDENTITY } from "../../../../../domain/rule-set/tool-identity.ts";
import { parseInlineConfigComment } from "../native-exceptions/inline-config-parser.ts";
import { siteRule } from "../pieces/rule-sites.ts";

const positionSchema = z.object({ line: z.number(), column: z.number() });

const inlineConfigNodesSchema = z.array(
  z.looseObject({
    type: z.enum(["Line", "Block"]),
    value: z.string(),
    loc: z.object({ start: positionSchema, end: positionSchema }),
  }),
);

type InlineConfigNode = z.output<typeof inlineConfigNodesSchema>[number];

export const MISNAMED_DISABLE_RULE = "misnamed-disable";

export const MISNAMED_DISABLE_RULE_ID = `${TOOL_IDENTITY.ownRuleSet}/${MISNAMED_DISABLE_RULE}`;

export const OWN_RULE_ID_PREFIX = `${TOOL_IDENTITY.ownRuleSet}/`;

const commentTextOf = (request: { readonly comment: InlineConfigNode }): string => {
  switch (request.comment.type) {
    case "Line":
      return `//${request.comment.value}`.trim();
    case "Block":
      return `/*${request.comment.value}*/`.trim();
  }
};

export const namedRuleIdsOf = (request: { readonly value: string }): readonly string[] => {
  const parsed = parseInlineConfigComment({ text: request.value });
  switch (parsed.kind) {
    case "disable":
    case "rule-config":
      return parsed.ruleIds;
    case "unparseable-rule-config":
    case "not-an-exception":
      return [];
  }
};

const namesAMisnamedRule = (request: {
  readonly comment: InlineConfigNode;
  readonly checkRuleIds: readonly string[];
}): "names-one" | "names-none" =>
  namedRuleIdsOf({ value: request.comment.value }).some(
    (ruleId) => ruleId.startsWith(OWN_RULE_ID_PREFIX) && !request.checkRuleIds.includes(ruleId),
  )
    ? "names-one"
    : "names-none";

type SourceCodeWithInlineConfig = {
  readonly text: string;
  readonly getInlineConfigNodes?: () => readonly unknown[];
};

const inlineConfigNodesOf = (request: {
  readonly sourceCode: SourceCodeWithInlineConfig;
}): readonly unknown[] | undefined => request.sourceCode.getInlineConfigNodes?.();

type MisnamedComment = { readonly comment: InlineConfigNode; readonly text: string };

export const misnamedCommentsIn = (request: {
  readonly nodes: unknown;
  readonly checkRuleIds: readonly string[];
}): readonly MisnamedComment[] => {
  const parsed = inlineConfigNodesSchema.safeParse(request.nodes);
  return (parsed.success ? parsed.data : [])
    .filter(
      (comment) =>
        namesAMisnamedRule({ comment, checkRuleIds: request.checkRuleIds }) === "names-one",
    )
    .map((comment) => ({ comment, text: commentTextOf({ comment }) }));
};

export const misnamedDisableRule = (request: { readonly checkRuleIds: readonly string[] }) =>
  siteRule({
    meta: { type: "problem", schema: [], messages: { misnamed: "{{text}}" } },
    observe: (context) => ({
      file: () => {
        misnamedCommentsIn({
          nodes: inlineConfigNodesOf({ sourceCode: context.sourceCode }),
          checkRuleIds: request.checkRuleIds,
        }).forEach((misnamed) => {
          context.report({
            loc: misnamed.comment.loc,
            messageId: "misnamed",
            data: { text: misnamed.text },
          });
        });
      },
    }),
  });
