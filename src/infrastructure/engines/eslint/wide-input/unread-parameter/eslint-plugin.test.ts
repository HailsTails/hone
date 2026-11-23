import { assert, describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { SourceCase } from "../../../../../domain/rule-set/rule-set-types.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { eslintPluginModuleSchema } from "../../runner/pieces/eslint-plugin-schema.ts";
import { createEslintPort } from "../../runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  loadEslintToolchain,
} from "../../runner/toolchain/eslint-toolchain.ts";
import plugin from "./eslint-plugin.ts";

const ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);
const loaded = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({ installRoot: ROOT, installForm: "source" }),
});
assert(loaded.outcome === "ok");
const eslint = createEslintPort({ toolchain: loaded.value });
const loadedPlugin = eslintPluginModuleSchema.parse({ default: plugin }).default;

const CASES: readonly SourceCase[] = [
  {
    name: "trailing parameters and unread destructured names",
    fileName: repoPathOf("src/order.ts"),
    source:
      "const delivery = (order: Order, _options: Options) => order.id;\nconst send = ({ order, options }: Input) => order.id;",
    expectedLines: [1, 2],
  },
  {
    name: "an unread slot before a value the callback reads",
    fileName: repoPathOf("src/order.ts"),
    source: "const delivery = (_error: Error, order: Order) => order.id;",
    expectedLines: [],
  },
  {
    name: "unread destructured bindings before a parameter that is read",
    fileName: repoPathOf("src/order.ts"),
    source:
      "const delivery = ({ order, options }: Input, log: Log) => log(order);\nconst send = ([order, options]: Pair = fallback, log: Log) => log(order);",
    expectedLines: [1, 2],
  },
  {
    name: "setters must declare one parameter",
    fileName: repoPathOf("src/order.ts"),
    source:
      "class Delivery { set order(input: Order) {} }\nconst delivery = { set order(input: Order) {} };",
    expectedLines: [],
  },
  {
    name: "unread parameters on class and object methods",
    fileName: repoPathOf("src/order.ts"),
    source:
      "class Delivery { send(order: Order) { return 1; } }\nconst delivery = { send(order: Order) { return 1; } };",
    expectedLines: [1, 2],
  },
  {
    name: "found through nested closures but not through shadowed names",
    fileName: repoPathOf("src/order.ts"),
    source:
      "const outer = (order: Order) => () => order.id;\nconst inner = (order: Order) => (order: Order) => order.id;",
    expectedLines: [2],
  },
  {
    name: "a write, type query or type predicate is not a value read",
    fileName: repoPathOf("src/order.ts"),
    source:
      "function load(order: Order) { order = fresh(); }\nfunction send(order: Order) { type Shape = typeof order; return {} satisfies Partial<Shape>; }\nconst isOrder = (value: unknown): value is Order => true;\nfunction assertOrder(value: unknown): asserts value is Order {}",
    expectedLines: [1, 2, 3, 4],
  },
  {
    name: "overload declarations and signatures have no body to read",
    fileName: repoPathOf("src/order.ts"),
    source:
      "declare function delivery(order: Order): string;\ntype Delivery = (input: Order) => string;",
    expectedLines: [],
  },
  {
    name: "standalone parameter updates do not constitute a read",
    fileName: repoPathOf("src/order.ts"),
    source:
      "function increment(value: number) { value++; }\nfunction add(value: number) { value += 1; }\nfunction returnPrevious(value: number) { return value++; }",
    expectedLines: [1, 2],
  },
  {
    name: "a function can read its parameters through arguments",
    fileName: repoPathOf("src/order.ts"),
    source:
      "function read(order: Order) { return arguments[0]; }\nfunction forward(order: Order) { publish(arguments); }",
    expectedLines: [],
  },
  {
    name: "a this parameter supplies the receiver type",
    fileName: repoPathOf("src/order.ts"),
    source: "function load(this: OrderStore) { return this.order; }",
    expectedLines: [],
  },
  {
    name: "constructor parameter properties initialise fields",
    fileName: repoPathOf("src/order.ts"),
    source:
      "class Delivery { constructor(config: Config, private readonly repo: Repo) {} find() { return this.repo.find(); } }",
    expectedLines: [],
  },
  {
    name: "bindings beside rest keep values out of the remainder",
    fileName: repoPathOf("src/order.ts"),
    source:
      "const omit = ({ order, ...rest }: Input) => rest;\nconst tail = ([first, ...rest]: Input) => rest;",
    expectedLines: [],
  },
  {
    name: "defaulted bindings beside rest keep values out of the remainder",
    fileName: repoPathOf("src/order.ts"),
    source: "const omit = ({ order = fallback, ...rest }: Input) => rest;",
    expectedLines: [],
  },
  {
    name: "an unread nested binding does not change its containing rest object",
    fileName: repoPathOf("src/order.ts"),
    source: "const omit = ({ order: { number }, ...rest }: Input) => rest;",
    expectedLines: [1],
  },
];

describe("the unread-parameter rule", () => {
  it.each(CASES)("matches the expected unread parameters for $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone",
        rule: "unread-parameter",
        options: [],
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});
