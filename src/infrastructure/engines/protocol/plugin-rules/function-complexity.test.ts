import { assert, describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import type { SourceCase } from "../../../../domain/rule-set/rule-set-types.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { eslintPluginModuleSchema } from "../../eslint/runner/pieces/eslint-plugin-schema.ts";
import { createEslintPort } from "../../eslint/runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  loadEslintToolchain,
} from "../../eslint/runner/toolchain/eslint-toolchain.ts";
import cd41Plugin from "./function-complexity.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd41Plugin }).default;

const loadedToolchain = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({
    installRoot: `${import.meta.dirname}/../../../../..`,
    installForm: "source",
  }),
});

const complexityFlagCases: readonly SourceCase[] = [
  {
    name: "six nested loops score twenty-one",
    fileName: repoPathOf("nested-loops.ts"),
    source:
      "function crawl(grid: number[][]): void {\n  for (const key in grid) {\n    for (const key in grid) {\n      for (const key in grid) {\n        for (const key in grid) {\n          for (const key in grid) {\n            for (const key in grid) {\n              console.log(b, d, f);\n            }\n          }\n        }\n      }\n    }\n  }\n}\n",
    expectedLines: [1],
  },
  {
    name: "a sixteen-branch else-if chain reports the arrow",
    fileName: repoPathOf("branchy-arrow.ts"),
    source:
      "export const route = (a: boolean, b: boolean, c: boolean, d: boolean, e: boolean, f: boolean, g: boolean, h: boolean, i: boolean, j: boolean, k: boolean, l: boolean, m: boolean, n: boolean, o: boolean, p: boolean): number => {\n  if (a) {\n    return 1;\n  } else if (b) {\n    return 2;\n  } else if (c) {\n    return 2;\n  } else if (d) {\n    return 2;\n  } else if (e) {\n    return 2;\n  } else if (f) {\n    return 2;\n  } else if (g) {\n    return 2;\n  } else if (h) {\n    return 2;\n  } else if (i) {\n    return 2;\n  } else if (j) {\n    return 2;\n  } else if (k) {\n    return 2;\n  } else if (l) {\n    return 2;\n  } else if (m) {\n    return 2;\n  } else if (n) {\n    return 2;\n  } else if (o) {\n    return 2;\n  } else if (p) {\n    return 2;\n  }\n  return 0;\n}\n",
    expectedLines: [1],
  },
];

const complexityAllowCases: readonly SourceCase[] = [
  {
    name: "a fifteen-branch else-if chain sits exactly on the limit",
    fileName: repoPathOf("limit-chain.ts"),
    source:
      "export function route(a: boolean, b: boolean, c: boolean, d: boolean, e: boolean, f: boolean, g: boolean, h: boolean, i: boolean, j: boolean, k: boolean, l: boolean, m: boolean, n: boolean, o: boolean): number {\n  if (a) {\n    return 1;\n  } else if (b) {\n    return 2;\n  } else if (c) {\n    return 2;\n  } else if (d) {\n    return 2;\n  } else if (e) {\n    return 2;\n  } else if (f) {\n    return 2;\n  } else if (g) {\n    return 2;\n  } else if (h) {\n    return 2;\n  } else if (i) {\n    return 2;\n  } else if (j) {\n    return 2;\n  } else if (k) {\n    return 2;\n  } else if (l) {\n    return 2;\n  } else if (m) {\n    return 2;\n  } else if (n) {\n    return 2;\n  } else if (o) {\n    return 2;\n  }\n  return 0;\n}\n",
    expectedLines: [],
  },
  {
    name: "five nested loops score fifteen",
    fileName: repoPathOf("five-loops.ts"),
    source:
      "function crawl(grid: number[][]): void {\n  for (const key in grid) {\n    for (const key in grid) {\n      for (const key in grid) {\n        for (const key in grid) {\n          for (const key in grid) {\n            console.log(b, d, e);\n          }\n        }\n      }\n    }\n  }\n}\n",
    expectedLines: [],
  },
  {
    name: "a switch counts once however many cases it has",
    fileName: repoPathOf("wide-switch.ts"),
    source:
      'export function label(code: number): string {\n  switch (code) {\n    case 1: return "a";\n    case 2: return "b";\n    case 3: return "c";\n    case 4: return "d";\n    case 5: return "e";\n    case 6: return "f";\n    case 7: return "g";\n    case 8: return "h";\n    case 9: return "i";\n    case 10: return "j";\n    case 11: return "k";\n    case 12: return "l";\n    case 13: return "m";\n    case 14: return "n";\n    case 15: return "o";\n    case 16: return "p";\n  }\n}\n',
    expectedLines: [],
  },
];

const lengthFlagCases: readonly SourceCase[] = [
  {
    name: "a function declaration with fifty-one body lines",
    fileName: repoPathOf("long-declaration.ts"),
    source:
      "export function sprawl(): void {\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n}\n",
    expectedLines: [1],
  },
  {
    name: "an arrow function with fifty-one body lines",
    fileName: repoPathOf("long-arrow.ts"),
    source:
      "export const sprawl = (): void => {\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n};\n",
    expectedLines: [1],
  },
  {
    name: "an it callback with fifty-one body lines inside a describe",
    fileName: repoPathOf("case-it.test.ts"),
    source:
      'describe("suite", () => {\n  it("sprawls", () => {\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n  });\n});\n',
    expectedLines: [2],
  },
  {
    name: "a test callback with fifty-one body lines",
    fileName: repoPathOf("case-test.test.ts"),
    source:
      'test("sprawls", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [1],
  },
  {
    name: "a helper declared in a describe body with fifty-one body lines",
    fileName: repoPathOf("case-helper.test.ts"),
    source:
      'describe("suite", () => {\n  const arrange = (): void => {\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n  };\n});\n',
    expectedLines: [2],
  },
  {
    name: "a describe-named member of another object",
    fileName: repoPathOf("case-member.ts"),
    source:
      'schema.describe("sprawl", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [1],
  },
  {
    name: "a function passed to describe's table, not as its callback",
    fileName: repoPathOf("case-table.test.ts"),
    source:
      'describe.each([() => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n}])("row", () => {});\n',
    expectedLines: [1],
  },
  {
    name: "a Benchmark suite's add callback",
    fileName: repoPathOf("bench-add.ts"),
    source:
      'suite.add("x", function () {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [1],
  },
  {
    name: "a Benchmark suite's on callback",
    fileName: repoPathOf("bench-on.ts"),
    source:
      'suite.on("cycle", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [1],
  },
  {
    name: "a Benchmark suite's run callback",
    fileName: repoPathOf("bench-run.ts"),
    source:
      "suite.run(() => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n",
    expectedLines: [1],
  },
  {
    name: "a forEach callback on a value named suite",
    fileName: repoPathOf("suite-for-each.ts"),
    source:
      "suite.forEach(() => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n",
    expectedLines: [1],
  },
  {
    name: "a member chain under describe that runs no suite",
    fileName: repoPathOf("describe-helpers.ts"),
    source:
      "describe.helpers.build(() => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n",
    expectedLines: [1],
  },
  {
    name: "a playwright test.describe.configure argument",
    fileName: repoPathOf("configure.test.ts"),
    source:
      "test.describe.configure(() => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n",
    expectedLines: [1],
  },
  {
    name: "an unknown member of playwright test.describe",
    fileName: repoPathOf("extend.test.ts"),
    source:
      "test.describe.extendsomething(() => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n",
    expectedLines: [1],
  },
  {
    name: "a mocha context callback",
    fileName: repoPathOf("context.test.ts"),
    source:
      'context("sprawl", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [1],
  },
];

const lengthAllowCases: readonly SourceCase[] = [
  {
    name: "a describe.concurrent callback with fifty-one body lines",
    fileName: repoPathOf("suite-concurrent.test.ts"),
    source:
      'describe.concurrent("sprawl", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a describe.runIf callback with fifty-one body lines",
    fileName: repoPathOf("suite-run-if.test.ts"),
    source:
      'describe.runIf(ci)("sprawl", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a describe.for callback with fifty-one body lines",
    fileName: repoPathOf("suite-for.test.ts"),
    source:
      'describe.for([1, 2])("sprawl %i", (value) => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a describe.only.each callback with fifty-one body lines",
    fileName: repoPathOf("suite-only-each.test.ts"),
    source:
      'describe.only.each([1, 2])("sprawl %i", (value) => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "an fsuite callback with fifty-one body lines",
    fileName: repoPathOf("suite-f.test.ts"),
    source:
      'fsuite("sprawl", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a playwright test.describe.serial callback with fifty-one body lines",
    fileName: repoPathOf("suite-serial.test.ts"),
    source:
      'test.describe.serial("sprawl", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a playwright test.describe.parallel.only callback with fifty-one body lines",
    fileName: repoPathOf("suite-parallel-only.test.ts"),
    source:
      'test.describe.parallel.only("sprawl", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a describe callback with fifty-one body lines",
    fileName: repoPathOf("suite-describe.test.ts"),
    source:
      'describe("sprawl", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a describe.each callback with fifty-one body lines",
    fileName: repoPathOf("suite-each.test.ts"),
    source:
      'describe.each([1, 2])("sprawl %i", (value) => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a jest describe.each template callback with fifty-one body lines",
    fileName: repoPathOf("suite-template.test.ts"),
    source:
      'describe.each`\n  value\n  one\n`("sprawl $value", ({ value }) => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a describe.skip callback with fifty-one body lines",
    fileName: repoPathOf("suite-skip.test.ts"),
    source:
      'describe.skip("sprawl", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a describe.skipIf callback with fifty-one body lines",
    fileName: repoPathOf("suite-skip-if.test.ts"),
    source:
      'describe.skipIf(ci)("sprawl", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a suite function expression with fifty-one body lines",
    fileName: repoPathOf("suite-suite.test.ts"),
    source:
      'suite("sprawl", function () {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a node:test describe callback after its options with fifty-one body lines",
    fileName: repoPathOf("suite-options.test.ts"),
    source:
      'describe("sprawl", { concurrency: 1 }, () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a playwright test.describe callback with fifty-one body lines",
    fileName: repoPathOf("suite-playwright.test.ts"),
    source:
      'test.describe("sprawl", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "an xdescribe callback with fifty-one body lines",
    fileName: repoPathOf("suite-x.test.ts"),
    source:
      'xdescribe("sprawl", () => {\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a describe nested in a describe, each with fifty-one body lines",
    fileName: repoPathOf("suite-nested.test.ts"),
    source:
      'describe("outer", () => {\n  describe("inner", () => {\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n      step();\n  });\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n    step();\n});\n',
    expectedLines: [],
  },
  {
    name: "a function with exactly fifty body lines",
    fileName: repoPathOf("limit-length.ts"),
    source:
      "export function sprawl(): void {\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n}\n",
    expectedLines: [],
  },
  {
    name: "a getter is exempt from the length limit",
    fileName: repoPathOf("long-getter.ts"),
    source:
      "export const holder = {\n  get sprawl(): void {\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  },\n};\n",
    expectedLines: [],
  },
  {
    name: "blank lines and braces do not count towards the length",
    fileName: repoPathOf("spaced-body.ts"),
    source: "export function spaced(): void {\n  if (ready()) {\n\n    step();\n\n  }\n}\n",
    expectedLines: [],
  },
];

describe("cognitive-complexity rule through the ESLint runner's lintSourceCases", () => {
  it.each([...complexityFlagCases, ...complexityAllowCases])(
    "flags exactly the expected lines of the case $name",
    async (sourceCase) => {
      assert(loadedToolchain.outcome === "ok");
      const eslint = createEslintPort({ toolchain: loadedToolchain.value });
      const findings = await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone-cd41",
        rule: "cognitive-complexity",
        options: [],
        cases: [sourceCase],
      });

      expect(findings).toEqual({
        outcome: "ok",
        value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
      });
    },
  );
});

describe("function-length rule through the ESLint runner's lintSourceCases", () => {
  it.each([...lengthFlagCases, ...lengthAllowCases])(
    "flags exactly the expected lines of the case $name",
    async (sourceCase) => {
      assert(loadedToolchain.outcome === "ok");
      const eslint = createEslintPort({ toolchain: loadedToolchain.value });
      const findings = await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone-cd41",
        rule: "function-length",
        options: [],
        cases: [sourceCase],
      });

      expect(findings).toEqual({
        outcome: "ok",
        value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
      });
    },
  );
});
