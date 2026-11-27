import { assert, describe, expect, it } from "vitest";

import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { DEFAULT_TEST_FILES } from "../../../../../domain/settings/test-files.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { observeWalkerFile } from "../../runner/observe-walker-file.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./test-type-declaration.ts";

const TEST_FILE = repoPathSchema.parse("src/orders.test.ts");
const TSX_TEST_FILE = repoPathSchema.parse("src/orders.test.tsx");
const ADDRESS = "type-declared-in-a-test#test-type-declaration";
const APPLICABLE = { applicable: [ADDRESS] };
const INAPPLICABLE = { applicable: [], inapplicable: [ADDRESS] };
const BINDING: CheckBinding = {
  address: ADDRESS,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/type-declared-in-a-test/test-type-declaration",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "test-type-declaration.ts" },
};

const loadedParse = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});

describe("test-type declarations", () => {
  it.each([
    {
      name: "reports type aliases, interfaces and enums inside a test file",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source: "type Amount = number;\ninterface Item { amount: Amount }\nenum State { Sent }",
      hits: [
        { file: TEST_FILE, check: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "Amount" },
        { file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Item" },
        { file: TEST_FILE, check: ADDRESS, anchor: { line: 3, column: 0 }, snippet: "State" },
      ],
    },
    {
      name: "reports a type declared inside a TSX test",
      file: TSX_TEST_FILE,
      coverage: APPLICABLE,
      source: 'it("checks an order", () => {\n  type Amount = number;\n});',
      hits: [
        { file: TSX_TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 2 }, snippet: "Amount" },
      ],
    },
    {
      name: "reports a namespace type beside module and global augmentations",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'export {};\ndeclare module "./orders.ts" { interface Order { priority: number } }\ndeclare global { interface Window { order: Order } }\nnamespace Fixtures { export type Amount = number; }',
      hits: [
        { file: TEST_FILE, check: ADDRESS, anchor: { line: 4, column: 21 }, snippet: "Amount" },
      ],
    },
    {
      name: "leaves a type declaration in a source file outside the test-file scope",
      file: repoPathSchema.parse("src/orders.ts"),
      coverage: INAPPLICABLE,
      source: "type Amount = number;",
      hits: [],
    },
    {
      name: "leaves a type declaration in an .mts test outside the test-file scope",
      file: repoPathSchema.parse("src/orders.test.mts"),
      coverage: INAPPLICABLE,
      source: "type Amount = number;",
      hits: [],
    },
    {
      name: "leaves a type declaration in a .cts test outside the test-file scope",
      file: repoPathSchema.parse("src/orders.test.cts"),
      coverage: INAPPLICABLE,
      source: "type Amount = number;",
      hits: [],
    },
    {
      name: "passes an inline type shape",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source: "const input: { amount: number } = { amount: 1 };",
      hits: [],
    },
    {
      name: "passes an object row of imported types, readonly lists and primitives",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order<Amount>; readonly earlier: readonly Order[]; readonly later: ReadonlyArray<Amount>; readonly name: string; readonly count: number; readonly sent: boolean; readonly total: bigint; readonly note: null; readonly missing: undefined };\nit.each<Row>([])("checks $order", () => {});',
      hits: [],
    },
    {
      name: "passes a tuple row of imported types, named or not",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = [order: Order, Amount, string];\nit.each<Row>([])("checks $order", () => {});',
      hits: [],
    },
    {
      name: "passes a row used by describe.each from a value import and a default import",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import Order from "../domain/order.ts";\nimport { Amount } from "./amount.ts";\ntype Row = { readonly order: Order; readonly amount: Amount };\ndescribe.each<Row>([])("an order", () => {});',
      hits: [],
    },
    {
      name: "reports an interface row",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ninterface Row { readonly order: Order }\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row declared inside a suite",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ndescribe("orders", () => {\n  type Row = { readonly order: Order };\n  it.each<Row>([])("checks $order", () => {});\n});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "Row" }],
    },
    {
      name: "reports a generic row",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row<Kind> = { readonly order: Order };\nit.each<Row<string>>([])("checks", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row also used outside a row table",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order };\nit.each<Row>([])("checks $order", () => {});\nconst first: Row = { order: 1 };',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row never used by a row table",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order };',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row given to test.each",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order };\ntest.each<Row>([])("checks", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row whose body is a nested type literal",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: { readonly amount: Amount } };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row whose body is a union",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order } | [Amount];\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member that is a union",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order | Amount };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member that is an intersection",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order & Amount };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member that is a literal type",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly state: "sent" };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member that is an indexed type",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly amount: Order["amount"] };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member that is a mapped type",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly totals: { [Key in Amount]: Order } };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member that is a conditional type",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order extends Amount ? Order : Amount };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member that is a typeof type",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\nconst order = 1;\ntype Row = { readonly order: typeof order };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 3, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member named by a local declaration",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Total = Amount;\ntype Row = { readonly total: Total };\nit.each<Row>([])("checks $order", () => {});',
      hits: [
        { file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Total" },
        { file: TEST_FILE, check: ADDRESS, anchor: { line: 3, column: 0 }, snippet: "Row" },
      ],
    },
    {
      name: "reports a row member that is a list of primitives",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly names: readonly string[] };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member that is a mutable list",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly orders: Order[] };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member whose type argument is a literal type",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order<"sent"> };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row with an optional property",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order; readonly amount?: Amount };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row with a method member",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order; total(): Amount };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports an empty object row",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = {};\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports an empty tuple row",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = [];\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a tuple row with an optional element",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = [order: Order, amount?: Amount];\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row of a type imported through a namespace",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type * as Orders from "./orders.ts";\ntype Row = { readonly order: Orders.Order };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "passes a readonly tuple row",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = readonly [order: Order, Amount];\nit.each<Row>([])("checks $order", () => {});',
      hits: [],
    },
    {
      name: "passes a row with a symbol member",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order; readonly key: symbol };\nit.each<Row>([])("checks $order", () => {});',
      hits: [],
    },
    {
      name: "reports a readonly array row",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = readonly Order[];\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a keyof row",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = keyof Order;\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member that is a ReadonlyArray of primitives",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly names: ReadonlyArray<string> };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member whose type argument is an intersection",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order<Amount & Order> };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports an exported row",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\nexport type Row = { readonly order: Order };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row named in an export statement",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly order: Order };\nexport type { Row };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a tuple row with a rest element",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = [order: Order, ...rest: Order[]];\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row with an index signature",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { [key: string]: Order };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member that is a ReadonlyArray without a type argument",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly orders: ReadonlyArray };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member that is a ReadonlyArray with two type arguments",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly orders: ReadonlyArray<Order, Amount> };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
    {
      name: "reports a row member that is a readonly tuple",
      file: TEST_FILE,
      coverage: APPLICABLE,
      source:
        'import type { Order, Amount } from "./orders.ts";\ntype Row = { readonly pair: readonly [Order] };\nit.each<Row>([])("checks $order", () => {});',
      hits: [{ file: TEST_FILE, check: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "Row" }],
    },
  ])("$name", ({ file, coverage, source, hits }) => {
    assert(loadedParse.outcome === "ok");
    const prepared = check.prepare({
      bindings: [BINDING],
      repository: {
        files: [file],
        exists: () => "present",
        disk: textsDisk({ root: "/repo", texts: {} }),
        testFiles: DEFAULT_TEST_FILES,
      },
      syntaxApi: loadedParse.value.syntaxApi,
    });
    assert(prepared.outcome === "ok");
    expect(
      observeWalkerFile({
        file: { file, readText: () => ({ outcome: "ok", value: source }) },
        pieces: [{ modulePath: BINDING.pieceRoot, bindings: [BINDING], check: prepared.value }],
        parse: loadedParse.value,
        escapes: [],
      }),
    ).toEqual({ outcome: "ok", value: { hits, nativeExceptions: [], ...coverage } });
  });
});
