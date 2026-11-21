import { describe, expect, it, vi } from "vitest";
import type { SourceCase } from "../../../../content-files/rule-sets/rule-set-reader.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { defaultEslintPort } from "../../../../../../tests/eslint-toolchains.ts";
import type { Rule } from "../toolchain/eslint-instance.ts";
import { eslintPluginModuleSchema } from "./eslint-plugin-schema.ts";
import { type FunctionSite, functionSiteOf, type RuleMeta, type SiteObservers, siteRule } from "./rule-sites.ts";

const RUNNER_ROOT = absolutePathSchema.parse(import.meta.dirname);

const SITE_META: RuleMeta = { type: "problem", schema: [], messages: { site: "site" } };

type ObservedSite = Parameters<NonNullable<SiteObservers[keyof SiteObservers]>>[0];

const reportingRule = (observe: (report: (node: ObservedSite) => void) => SiteObservers): Rule.RuleModule =>
  siteRule({ meta: SITE_META, observe: (context) => observe((node) => context.report({ node, messageId: "site" })) });

const sitesPlugin = eslintPluginModuleSchema.parse({
  default: {
    rules: {
      file: reportingRule((report) => ({ file: report })),
      functions: reportingRule((report) => ({ functions: report })),
      classes: reportingRule((report) => ({ classes: report })),
      calls: reportingRule((report) => ({ calls: report })),
      throws: reportingRule((report) => ({ throws: report })),
      ifs: reportingRule((report) => ({ ifs: report })),
      "variable-declarations": reportingRule((report) => ({ variableDeclarations: report })),
      "calls-and-ifs": reportingRule((report) => ({ calls: report, ifs: report })),
    },
  },
}).default;

const MIXED_SOURCE =
  'void 0;\nfunction declared() {}\nconst expressed = function () {};\nconst arrow = () => 0;\nclass Declared {}\nconst Expressed = class {};\nrun();\nif (ready) {}\nthrow new Error("stop");\n';

const SITE_CASES: readonly { readonly rule: string; readonly expectedLines: readonly number[] }[] = [
  { rule: "file", expectedLines: [1] },
  { rule: "functions", expectedLines: [2, 3, 4] },
  { rule: "classes", expectedLines: [5, 6] },
  { rule: "calls", expectedLines: [7] },
  { rule: "throws", expectedLines: [9] },
  { rule: "ifs", expectedLines: [8] },
  { rule: "variable-declarations", expectedLines: [3, 4, 6] },
  { rule: "calls-and-ifs", expectedLines: [7, 8] },
];

const mixedCase = (request: { readonly expectedLines: readonly number[] }): SourceCase => ({
  name: "one of each site",
  fileName: repoPathSchema.parse("sites.ts"),
  source: MIXED_SOURCE,
  expectedLines: [...request.expectedLines],
});

describe("siteRule through the ESLint runner's lintSourceCases", () => {
  it.each(SITE_CASES)("calls the $rule observers at exactly their sites and no others", async ({ rule, expectedLines }) => {
    expect(
      await defaultEslintPort.lintSourceCases({
        cwd: RUNNER_ROOT,
        plugin: sitesPlugin,
        pluginNamespace: "sites",
        rule,
        options: [],
        cases: [mixedCase({ expectedLines })],
      }),
    ).toEqual({ outcome: "ok", value: [{ caseName: "one of each site", flaggedLines: expectedLines }] });
  });
});

const CALLS_SOURCE =
  "const arrow = () => run();\nconst expressed = function () {\n  return run();\n};\nconst value = run();\nvoid [1].map(() => run());\n";

const lintObserved = (request: { readonly observers: SiteObservers; readonly source: string }) =>
  defaultEslintPort.lintSourceCases({
    cwd: RUNNER_ROOT,
    plugin: eslintPluginModuleSchema.parse({
      default: { rules: { observed: siteRule({ meta: SITE_META, observe: () => request.observers }) } },
    }).default,
    pluginNamespace: "sites",
    rule: "observed",
    options: [],
    cases: [{ name: "observed", fileName: repoPathSchema.parse("observed.ts"), source: request.source, expectedLines: [] }],
  });

describe("functionSiteOf", () => {
  it("narrows each kind of function site to that same node", async () => {
    const seen = vi.fn<(site: FunctionSite | undefined) => void>();
    await lintObserved({ observers: { functions: (site) => seen(functionSiteOf({ node: site })) }, source: MIXED_SOURCE });
    expect(seen).toHaveBeenCalledTimes(3);
    expect(seen).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: "FunctionDeclaration" }));
    expect(seen).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: "FunctionExpression" }));
    expect(seen).toHaveBeenNthCalledWith(3, expect.objectContaining({ type: "ArrowFunctionExpression" }));
  });

  it("finds a function only where a call's parent is one", async () => {
    const seen = vi.fn<(site: FunctionSite | undefined) => void>();
    await lintObserved({ observers: { calls: (site) => seen(functionSiteOf({ node: site.parent })) }, source: CALLS_SOURCE });
    expect(seen).toHaveBeenCalledTimes(5);
    expect(seen).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: "ArrowFunctionExpression", body: expect.objectContaining({ type: "CallExpression" }) }));
    expect(seen).toHaveBeenNthCalledWith(2, undefined);
    expect(seen).toHaveBeenNthCalledWith(3, undefined);
    expect(seen).toHaveBeenNthCalledWith(4, undefined);
    expect(seen).toHaveBeenNthCalledWith(5, expect.objectContaining({ type: "ArrowFunctionExpression" }));
  });

  it("reads a class site as no function", async () => {
    const seen = vi.fn<(site: FunctionSite | undefined) => void>();
    await lintObserved({ observers: { classes: (site) => seen(functionSiteOf({ node: site })) }, source: MIXED_SOURCE });
    expect(seen).toHaveBeenCalledTimes(2);
    expect(seen).toHaveBeenNthCalledWith(1, undefined);
    expect(seen).toHaveBeenNthCalledWith(2, undefined);
  });
});
