import { siteRule, type SiteObservers } from "../../runner/pieces/rule-sites.ts";
import type { AST, Rule } from "../../runner/toolchain/eslint-instance.ts";

type CalleeNode = {
  readonly type: string;
  readonly name?: string;
  readonly value?: unknown;
  readonly object?: CalleeNode;
  readonly property?: CalleeNode;
  readonly loc?: AST.SourceLocation | null;
};

type CalleeLink = { readonly name: string; readonly node: CalleeNode };

type CalleeChain = { readonly root: CalleeLink; readonly members: readonly CalleeLink[] };

type TestModifier = {
  readonly bareNames: ReadonlySet<string>;
  readonly roots: ReadonlySet<string>;
  readonly members: ReadonlySet<string>;
};

const TEST_ROOTS: ReadonlySet<string> = new Set(["describe", "it", "test", "suite"]);

const FOCUSED: TestModifier = {
  bareNames: new Set(["fdescribe", "fit", "ftest", "fsuite"]),
  roots: TEST_ROOTS,
  members: new Set(["only"]),
};

const SKIPPED: TestModifier = {
  bareNames: new Set(["xdescribe", "xit", "xtest", "xsuite"]),
  roots: TEST_ROOTS,
  members: new Set(["skip", "fixme"]),
};

const CONDITIONAL_AND_TODO = "conditional-and-todo";

const EXTENDED_SKIPS: TestModifier = {
  ...SKIPPED,
  members: new Set([...SKIPPED.members, "todo", "skipIf", "runIf"]),
};

const memberName = (request: { readonly property: CalleeNode | undefined }): string | undefined => {
  if (request.property?.type === "Identifier") {
    return request.property.name;
  }
  return typeof request.property?.value === "string" ? request.property.value : undefined;
};

const calleeChainOf = (request: {
  readonly callee: CalleeNode;
  readonly members: readonly CalleeLink[];
}): CalleeChain | undefined => {
  if (request.callee.type === "Identifier" && request.callee.name !== undefined) {
    return { root: { name: request.callee.name, node: request.callee }, members: request.members };
  }
  if (request.callee.type !== "MemberExpression" || request.callee.object === undefined) {
    return undefined;
  }
  const name = memberName({ property: request.callee.property });
  if (name === undefined || request.callee.property === undefined) {
    return undefined;
  }
  return calleeChainOf({
    callee: request.callee.object,
    members: [{ name, node: request.callee.property }, ...request.members],
  });
};

const modifiedLink = (request: {
  readonly callee: CalleeNode;
  readonly modifier: TestModifier;
}): CalleeLink | undefined => {
  const chain = calleeChainOf({ callee: request.callee, members: [] });
  if (chain === undefined) {
    return undefined;
  }
  if (chain.members.length === 0) {
    return request.modifier.bareNames.has(chain.root.name) ? chain.root : undefined;
  }
  const links = [chain.root, ...chain.members];
  const testFunction = links.findIndex((link) => request.modifier.roots.has(link.name));
  return testFunction === -1
    ? undefined
    : links.slice(testFunction + 1).find((link) => request.modifier.members.has(link.name));
};

const observeModifier = (request: {
  readonly context: Rule.RuleContext;
  readonly modifier: TestModifier;
}): SiteObservers => ({
  calls: (node) => {
    const loc = modifiedLink({ callee: node.callee, modifier: request.modifier })?.node.loc;
    if (loc === undefined || loc === null) return;
    request.context.report({ loc, messageId: "modifiedTest" });
  },
});

const focusedRule = (modifier: TestModifier): Rule.RuleModule =>
  siteRule({
    meta: {
      type: "problem",
      docs: { description: "Disallow focused tests" },
      schema: [],
      messages: { modifiedTest: "remove the focus so every test runs." },
    },
    observe: (context) => observeModifier({ context, modifier }),
  });

const skippedRule = (request: {
  readonly defaultModifier: TestModifier;
  readonly byOption: ReadonlyMap<string, TestModifier>;
}): Rule.RuleModule =>
  siteRule({
    meta: {
      type: "problem",
      docs: { description: "Disallow skipped tests" },
      schema: [{ enum: [...request.byOption.keys()] }],
      messages: { modifiedTest: "remove the skip so the test runs, or delete the test." },
    },
    observe: (context) => {
      const [option]: readonly unknown[] = context.options;
      const selected = typeof option === "string" ? request.byOption.get(option) : undefined;
      return observeModifier({ context, modifier: selected ?? request.defaultModifier });
    },
  });

export default {
  meta: { name: "hone-cd27", version: "0.0.0-local" },
  rules: {
    "focused-tests": focusedRule(FOCUSED),
    "skipped-tests": skippedRule({
      defaultModifier: SKIPPED,
      byOption: new Map([[CONDITIONAL_AND_TODO, EXTENDED_SKIPS]]),
    }),
  },
};
