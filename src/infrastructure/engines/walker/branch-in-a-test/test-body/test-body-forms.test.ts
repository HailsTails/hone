import { assert, describe, expect, it, vi } from "vitest";

import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { Edition } from "../../../../../domain/rule-set/edition-types.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { Remedy } from "../../../../../domain/runner/runner-result-types.ts";
import { observeWalkerFile } from "../../runner/observe-walker-file.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import type { WalkerFile, WalkerRepository } from "../../runner/pieces/walker-piece.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import {
  check,
  declarationsOf,
  TEST_BODY_FORMS,
  TEST_BODY_REMEDIES,
  testBodyFormOf,
} from "./test-body-logic.ts";

const FILE = repoPathOf("src/form.test.ts");

const ADDRESS: CheckAddressText = "branch-in-a-test#test-body";

const FIRST_EDITION: Edition = editionOf("1");

const SECOND_EDITION: Edition = editionOf("2");

const PIECE_ROOT = "/install/walker/branch-in-a-test/test-body";

const FIRST_EDITION_BINDING: CheckBinding = {
  address: ADDRESS,
  ruleSet: "hone",
  engine: "walker",
  forms: {
    "branching-with-if": ADDRESS,
    "a-try-block": ADDRESS,
    "a-ternary": ADDRESS,
    "a-let": ADDRESS,
    "a-method-that-picks-or-tests-an-element": ADDRESS,
    "a-method-that-computes-a-value": ADDRESS,
    "a-method-that-mutates": ADDRESS,
    "a-short-circuit": ADDRESS,
    "an-optional-chain-after-an-index": ADDRESS,
    "an-optional-chain-on-a-mock-call": ADDRESS,
    "an-optional-chain-on-a-mock-result": ADDRESS,
    "an-optional-chain-on-a-property": ADDRESS,
    "an-optional-call": ADDRESS,
    "a-switch": ADDRESS,
    "serialising-or-parsing-json": ADDRESS,
    "merging-objects": ADDRESS,
    "building-an-object-from-entries": ADDRESS,
    "building-an-array-from-a-length": ADDRESS,
    "a-math-call": ADDRESS,
    "logic-inside-a-function-the-test-passes-on": ADDRESS,
  },
  anchor: { kind: "file" },
  pieceRoot: PIECE_ROOT,
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "test-body-logic.ts" },
};

const SECOND_EDITION_BINDING: CheckBinding = { ...FIRST_EDITION_BINDING, edition: SECOND_EDITION };

const REPOSITORY: WalkerRepository = {
  files: [repoPathOf("package.json"), repoPathOf("packages/paths/package.json"), FILE],
  exists: vi.fn().mockReturnValue("present"),
  disk: textsDisk({
    root: "/repo",
    texts: {
      "package.json": '{ "name": "app" }',
      "packages/paths/package.json": '{ "name": "@app/paths" }',
    },
  }),
  testFiles: { suffixes: ["test", "spec"], folders: [] },
};

const PASSED_ON_FUNCTION_REMEDY: Remedy = {
  fix: "A callback with its own logic makes the test depend on a second implementation. Give the collaborator a fixed answer and assert how it was used.",
  form: "logic-inside-a-function-the-test-passes-on",
};

const COMPUTING_METHOD_REMEDY: Remedy = {
  fix: "Computing the expectation can repeat the mistake in the implementation. Write the expected value out.",
  form: "a-method-that-computes-a-value",
};

const PICKING_METHOD_REMEDY: Remedy = {
  fix: "Selecting an element can discard data the caller should see. Assert the whole returned collection.",
  form: "a-method-that-picks-or-tests-an-element",
};

const MUTATING_METHOD_REMEDY: Remedy = {
  fix: "Mutating the expected collection obscures its final state. State the finished collection so the reader can see what should be returned.",
  form: "a-method-that-mutates",
};

const STATEMENT_FORMS = [
  { name: "an if statement", source: "if (ok) {}", edition: "1", form: "branching-with-if" },
  { name: "a try statement", source: "try {} catch {}", edition: "1", form: "a-try-block" },
  { name: "a let statement", source: "let total = 1;", edition: "1", form: "a-let" },
  { name: "a switch statement", source: "switch (kind) {}", edition: "2", form: "a-switch" },
];

const EXPRESSION_FORMS = [
  { name: "a ternary", source: "ok ? 1 : 2;", edition: "1", form: "a-ternary" },
  {
    name: "find",
    source: "rows.find(isFirst);",
    edition: "1",
    form: "a-method-that-picks-or-tests-an-element",
  },
  {
    name: "at",
    source: "rows.at(0);",
    edition: "1",
    form: "a-method-that-picks-or-tests-an-element",
  },
  {
    name: "includes",
    source: "rows.includes(row);",
    edition: "1",
    form: "a-method-that-picks-or-tests-an-element",
  },
  {
    name: "map",
    source: "rows.map(idOf);",
    edition: "1",
    form: "a-method-that-computes-a-value",
  },
  {
    name: "join",
    source: 'parts.join(",");',
    edition: "1",
    form: "a-method-that-computes-a-value",
  },
  { name: "push", source: "rows.push(row);", edition: "1", form: "a-method-that-mutates" },
  { name: "fill", source: "rows.fill(0);", edition: "1", form: "a-method-that-mutates" },
  { name: "a nullish fallback", source: "given ?? 1;", edition: "2", form: "a-short-circuit" },
  { name: "a logical and", source: "left && right;", edition: "2", form: "a-short-circuit" },
  {
    name: "a logical or assignment",
    source: "given ||= 1;",
    edition: "2",
    form: "a-short-circuit",
  },
  {
    name: "an optional property after an index",
    source: "tasks[0]?.id;",
    edition: "2",
    form: "an-optional-chain-after-an-index",
  },
  {
    name: "an optional element after an index",
    source: "rows[0]?.[1];",
    edition: "2",
    form: "an-optional-chain-after-an-index",
  },
  {
    name: "an optional chain on a mock call",
    source: "run.mock.calls[0]?.[0];",
    edition: "2",
    form: "an-optional-chain-on-a-mock-call",
  },
  {
    name: "an optional chain on a mock result",
    source: "run.mock.results[0]?.value;",
    edition: "2",
    form: "an-optional-chain-on-a-mock-result",
  },
  {
    name: "an optional chain on a mock's last call",
    source: "run.mock.lastCall?.[0];",
    edition: "2",
    form: "an-optional-chain-on-a-mock-call",
  },
  {
    name: "an optional chain on a mock instance",
    source: "Store.mock.instances[0]?.rows;",
    edition: "2",
    form: "an-optional-chain-after-an-index",
  },
  {
    name: "an optional chain on a mock context",
    source: "run.mock.contexts[0]?.name;",
    edition: "2",
    form: "an-optional-chain-after-an-index",
  },
  {
    name: "an optional property",
    source: "result.value?.name;",
    edition: "2",
    form: "an-optional-chain-on-a-property",
  },
  {
    name: "an optional call",
    source: "observers.enter?.();",
    edition: "2",
    form: "an-optional-call",
  },
  {
    name: "an optional call of a computing method",
    source: "rows.map?.(idOf);",
    edition: "1",
    form: "a-method-that-computes-a-value",
  },
  {
    name: "Object.keys",
    source: "Object.keys(value);",
    edition: "1",
    form: "a-method-that-computes-a-value",
  },
  {
    name: "JSON.stringify",
    source: "JSON.stringify(value);",
    edition: "2",
    form: "serialising-or-parsing-json",
  },
  {
    name: "JSON.parse",
    source: "JSON.parse(text);",
    edition: "2",
    form: "serialising-or-parsing-json",
  },
  {
    name: "Object.assign",
    source: "Object.assign(target, source);",
    edition: "2",
    form: "merging-objects",
  },
  {
    name: "Object.fromEntries",
    source: "Object.fromEntries(pairs);",
    edition: "2",
    form: "building-an-object-from-entries",
  },
  {
    name: "Array.from",
    source: "Array.from({ length: 3 });",
    edition: "2",
    form: "building-an-array-from-a-length",
  },
  { name: "a Math method", source: "Math.max(a, b);", edition: "2", form: "a-math-call" },
];

const PLAIN_EXPRESSIONS = [
  { name: "element access", source: "rows[0];" },
  { name: "a free call", source: "build(rows);" },
  { name: "a computed method call", source: 'rows["map"](idOf);' },
  { name: "an assert.isDefined call", source: "assert.isDefined(first);" },
  { name: "a toMatchObject call", source: 'expect(first).toMatchObject({ id: "a" });' },
  { name: "an unlisted JSON method", source: "JSON.rawJSON(text);" },
  { name: "an unlisted Object method", source: "Object.freeze(value);" },
];

describe("testBodyFormOf", () => {
  it.each(STATEMENT_FORMS)(
    "names $name as introduced in edition $edition with the $form fix",
    async ({ source, edition, form }) => {
      const loaded = await loadParsePort({
        peers: defaultTypeScriptPeers({
          installRoot: `${import.meta.dirname}/../../../../../..`,
          installForm: "source",
        }),
      });
      assert(loaded.outcome === "ok");
      const { syntaxApi } = loaded.value;
      const sourceFile = syntaxApi.createSourceFile(
        "form.test.ts",
        source,
        syntaxApi.ScriptTarget.Latest,
        true,
      );
      const node = sourceFile.getChildAt(0).getChildAt(0);
      const declarations = declarationsOf({ syntaxApi, sourceFile });

      const named = testBodyFormOf({
        syntaxApi,
        node,
        ownPackageNames: ["@app/paths"],
        declarations,
      });

      expect(named).toMatchObject({
        introducedIn: edition,
        remedy: { form },
      });
    },
  );

  it.each(EXPRESSION_FORMS)(
    "names $name as introduced in edition $edition with the $form fix",
    async ({ source, edition, form }) => {
      const loaded = await loadParsePort({
        peers: defaultTypeScriptPeers({
          installRoot: `${import.meta.dirname}/../../../../../..`,
          installForm: "source",
        }),
      });
      assert(loaded.outcome === "ok");
      const { syntaxApi } = loaded.value;
      const sourceFile = syntaxApi.createSourceFile(
        "form.test.ts",
        source,
        syntaxApi.ScriptTarget.Latest,
        true,
      );
      const node = sourceFile.getChildAt(0).getChildAt(0).getChildAt(0);
      const declarations = declarationsOf({ syntaxApi, sourceFile });

      const named = testBodyFormOf({
        syntaxApi,
        node,
        ownPackageNames: ["@app/paths"],
        declarations,
      });

      expect(named).toMatchObject({
        introducedIn: edition,
        remedy: { form },
      });
    },
  );

  it.each(PLAIN_EXPRESSIONS)("names no form for $name", async ({ source }) => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const sourceFile = syntaxApi.createSourceFile(
      "form.test.ts",
      source,
      syntaxApi.ScriptTarget.Latest,
      true,
    );
    const node = sourceFile.getChildAt(0).getChildAt(0).getChildAt(0);
    const declarations = declarationsOf({ syntaxApi, sourceFile });

    const named = testBodyFormOf({
      syntaxApi,
      node,
      ownPackageNames: ["@app/paths"],
      declarations,
    });

    expect(named).toBeUndefined();
  });

  it("names no form for a const statement", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const sourceFile = syntaxApi.createSourceFile(
      "form.test.ts",
      "const total = 1;",
      syntaxApi.ScriptTarget.Latest,
      true,
    );
    const node = sourceFile.getChildAt(0).getChildAt(0);
    const declarations = declarationsOf({ syntaxApi, sourceFile });

    const named = testBodyFormOf({
      syntaxApi,
      node,
      ownPackageNames: ["@app/paths"],
      declarations,
    });

    expect(named).toBeUndefined();
  });

  it("attaches advice to the optional-chain form for an indexed element", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const sourceFile = syntaxApi.createSourceFile(
      "form.test.ts",
      "tasks[0]?.id;",
      syntaxApi.ScriptTarget.Latest,
      true,
    );
    const node = sourceFile.getChildAt(0).getChildAt(0).getChildAt(0);
    const declarations = declarationsOf({ syntaxApi, sourceFile });

    const named = testBodyFormOf({
      syntaxApi,
      node,
      ownPackageNames: ["@app/paths"],
      declarations,
    });

    expect(named).toEqual({
      introducedIn: "2",
      remedy: {
        fix: "Optional access hides whether the expected element exists. Assert the whole collection, or assert that the element is defined and then read it.",
        form: "an-optional-chain-after-an-index",
      },
    });
  });
});

describe("TEST_BODY_FORMS", () => {
  it("lists each form a finding can name, once, in the order the forms are written", () => {
    expect(TEST_BODY_FORMS).toEqual([
      "branching-with-if",
      "a-try-block",
      "a-ternary",
      "a-let",
      "a-method-that-picks-or-tests-an-element",
      "a-method-that-computes-a-value",
      "a-method-that-mutates",
      "a-short-circuit",
      "an-optional-chain-after-an-index",
      "an-optional-chain-on-a-mock-call",
      "an-optional-chain-on-a-mock-result",
      "an-optional-chain-on-a-property",
      "an-optional-call",
      "a-switch",
      "serialising-or-parsing-json",
      "merging-objects",
      "building-an-object-from-entries",
      "building-an-array-from-a-length",
      "a-math-call",
      "logic-inside-a-function-the-test-passes-on",
    ]);
  });
});

type RemedyRow = { readonly index: number; readonly remedy: Remedy };

describe("TEST_BODY_REMEDIES", () => {
  it.each<RemedyRow>([
    {
      index: 0,
      remedy: {
        fix: "The test branches because the unit can return more than one shape. Give each outcome its own test or make the return type express the one outcome callers can rely on.",
        form: "branching-with-if",
      },
    },
    {
      index: 1,
      remedy: {
        fix: "Catching inside the test can let it pass when no error occurs. Assert the failure the unit returns. Where an adapter's caller relies on a throw, assert the throw.",
        form: "a-try-block",
      },
    },
    {
      index: 2,
      remedy: {
        fix: "The test chooses between values at runtime. State the expected value for each case so the assertion cannot adapt to the result.",
        form: "a-ternary",
      },
    },
    {
      index: 3,
      remedy: {
        fix: "A reassigned local makes the test depend on hidden state. Keep the expected values fixed and assert the interaction you need to observe.",
        form: "a-let",
      },
    },
    {
      index: 4,
      remedy: {
        fix: "Selecting an element can discard data the caller should see. Assert the whole returned collection.",
        form: "a-method-that-picks-or-tests-an-element",
      },
    },
    {
      index: 5,
      remedy: {
        fix: "Computing the expectation can repeat the mistake in the implementation. Write the expected value out.",
        form: "a-method-that-computes-a-value",
      },
    },
    {
      index: 6,
      remedy: {
        fix: "Mutating the expected collection obscures its final state. State the finished collection so the reader can see what should be returned.",
        form: "a-method-that-mutates",
      },
    },
    {
      index: 7,
      remedy: {
        fix: "Short-circuiting lets the test skip a case when the unit returns an optional or falsy value. Make required output explicit in the unit's type or test each outcome separately.",
        form: "a-short-circuit",
      },
    },
    {
      index: 8,
      remedy: {
        fix: "Optional access hides whether the expected element exists. Assert the whole collection, or assert that the element is defined and then read it.",
        form: "an-optional-chain-after-an-index",
      },
    },
    {
      index: 9,
      remedy: {
        fix: "Optional access hides whether the dependency was called. Assert the expected call and its arguments.",
        form: "an-optional-chain-on-a-mock-call",
      },
    },
    {
      index: 10,
      remedy: {
        fix: "Optional access hides whether the dependency returned a value. Write out what the collaborator gives back, then check what the unit returns and the call it makes.",
        form: "an-optional-chain-on-a-mock-result",
      },
    },
    {
      index: 11,
      remedy: {
        fix: "The returned object can omit a property the caller needs. Make that property required in the unit's return type or test its absence as a separate outcome.",
        form: "an-optional-chain-on-a-property",
      },
    },
    {
      index: 12,
      remedy: {
        fix: "The unit's output makes the function optional, so callers cannot count on being able to call it. Make the function required in the return type or test the absent case separately.",
        form: "an-optional-call",
      },
    },
    {
      index: 13,
      remedy: {
        fix: "The test branches on a value and can omit assertions for unexpected cases. State the expected outcome for each case separately.",
        form: "a-switch",
      },
    },
    {
      index: 14,
      remedy: {
        fix: "Serializing or parsing inside the test can obscure the returned structure. Assert the object the caller needs and leave its wire format to the boundary adapter.",
        form: "serialising-or-parsing-json",
      },
    },
    {
      index: 15,
      remedy: {
        fix: "Building the expected object by mutation obscures its final shape. State the fields the caller should see and make any copied fields explicit.",
        form: "merging-objects",
      },
    },
    {
      index: 16,
      remedy: {
        fix: "Building the expected object from entries hides the shape the assertion promises. Write the whole object out.",
        form: "building-an-object-from-entries",
      },
    },
    {
      index: 17,
      remedy: {
        fix: "Generating the expected array hides the sequence being asserted. Write the array out.",
        form: "building-an-array-from-a-length",
      },
    },
    {
      index: 18,
      remedy: {
        fix: "Calculating the expected number can reproduce the implementation's error. State the expected number directly.",
        form: "a-math-call",
      },
    },
    {
      index: 19,
      remedy: {
        fix: "A callback with its own logic makes the test depend on a second implementation. Give the collaborator a fixed answer and assert how it was used.",
        form: "logic-inside-a-function-the-test-passes-on",
      },
    },
  ])("gives remedy $index its written-out fix, page and form", ({ index, remedy }) => {
    expect(TEST_BODY_REMEDIES[index]).toEqual(remedy);
  });
});

const FIRST_EDITION_DOUBLE_SITES = [
  {
    name: "a callback passed to the unit",
    source: "runWith(() => rows.map(idOf));",
    line: 1,
    column: 14,
    snippet: "rows.map(idOf));",
  },
  {
    name: "an arrow property",
    source: "const port = { isFile: (path) => files.includes(path) };",
    line: 1,
    column: 33,
    snippet: "files.includes(path) };",
  },
  {
    name: "a method",
    source: "const port = { isFile(path) { return files.includes(path); } };",
    line: 1,
    column: 37,
    snippet: "files.includes(path); } };",
  },
  {
    name: "a double passed inline",
    source: 'run({ fileKind: { isFile: (path) => path.endsWith(".ts") } });',
    line: 1,
    column: 36,
    snippet: 'path.endsWith(".ts") } });',
  },
  {
    name: "a branch inside a method",
    source: "const port = { read(path) { if (path) {} } };",
    line: 1,
    column: 28,
    snippet: "if (path) {} } };",
  },
  {
    name: "a function in an it.each row",
    source: 'it.each([{ check: (rows) => rows.map(idOf) }])("checks", run);',
    line: 1,
    column: 28,
    snippet: 'rows.map(idOf) }])("checks", run);',
  },
  {
    name: "a route map handler",
    source: 'serve({ "/tasks": (request) => request.ids.map(idOf) });',
    line: 1,
    column: 31,
    snippet: "request.ids.map(idOf) });",
  },
];

const SECOND_EDITION_DOUBLE_SITES = [
  {
    name: "a function expression property",
    source: 'const port = { read: function () { return given ?? ""; } };',
    line: 1,
    column: 42,
    snippet: 'given ?? ""; } };',
  },
  {
    name: "an options callback",
    source: "run({ onProgress: (event) => event.done && seen(event) });",
    line: 1,
    column: 29,
    snippet: "event.done && seen(event) });",
  },
  {
    name: "a fixture getter",
    source: "const fixture = { get rows() { return given ?? []; } };",
    line: 1,
    column: 38,
    snippet: "given ?? []; } };",
  },
  {
    name: "a vi.fn implementation",
    source: "const clock = { now: vi.fn(() => given ?? 1) };",
    line: 1,
    column: 33,
    snippet: "given ?? 1) };",
  },
  {
    name: "a bare vi.fn implementation",
    source: "const now = vi.fn(() => given ?? 1);",
    line: 1,
    column: 24,
    snippet: "given ?? 1);",
  },
  {
    name: "a mockImplementation",
    source: "now.mockImplementation(() => given ?? 1);",
    line: 1,
    column: 29,
    snippet: "given ?? 1);",
  },
];

const OUTSIDE_DOUBLE_SITES = [
  {
    name: "a test callback",
    source: 'it("reads", () => { rows.map(idOf); });',
    line: 1,
    column: 20,
    snippet: "rows.map(idOf); });",
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "a const arrow",
    source: "const idsOf = () => rows.map(idOf);",
    line: 1,
    column: 20,
    snippet: "rows.map(idOf);",
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "an object literal value that is not a function",
    source: "const row = { ids: rows.map(idOf) };",
    line: 1,
    column: 19,
    snippet: "rows.map(idOf) };",
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "a callback inside a double's method",
    source: "const port = { all: () => run(() => rows.map(idOf)) };",
    line: 1,
    column: 36,
    snippet: "rows.map(idOf)) };",
    remedy: COMPUTING_METHOD_REMEDY,
  },
];

type SiteRow = {
  readonly name: string;
  readonly source: string;
  readonly line: number;
  readonly column: number;
  readonly snippet: string;
};

type RemediedSiteRow = {
  readonly name: string;
  readonly source: string;
  readonly line: number;
  readonly column: number;
  readonly snippet: string;
  readonly remedy: Remedy;
};

describe("the walker inside a function the test passes on", () => {
  it.each<SiteRow>(FIRST_EDITION_DOUBLE_SITES)(
    "names the passed-on function fix under the first edition for logic in $name",
    async ({ source, line, column, snippet }) => {
      const loaded = await loadParsePort({
        peers: defaultTypeScriptPeers({
          installRoot: `${import.meta.dirname}/../../../../../..`,
          installForm: "source",
        }),
      });
      assert(loaded.outcome === "ok");
      const prepared = check.prepare({
        bindings: [FIRST_EDITION_BINDING],
        repository: REPOSITORY,
        syntaxApi: loaded.value.syntaxApi,
      });
      assert(prepared.outcome === "ok");

      const observed = observeWalkerFile({
        file: {
          file: FILE,
          readText: vi
            .fn<WalkerFile["readText"]>()
            .mockReturnValue({ outcome: "ok", value: source }),
        },
        pieces: [
          { modulePath: PIECE_ROOT, bindings: [FIRST_EDITION_BINDING], check: prepared.value },
        ],
        parse: loaded.value,
        escapes: [],
      });

      expect(observed).toEqual({
        outcome: "ok",
        value: {
          hits: [
            {
              file: FILE,
              check: ADDRESS,
              anchor: { line, column },
              snippet,
              remedy: PASSED_ON_FUNCTION_REMEDY,
            },
          ],
          nativeExceptions: [],
          applicable: [ADDRESS],
        },
      });
    },
  );

  it.each<SiteRow>(SECOND_EDITION_DOUBLE_SITES)(
    "names the passed-on function fix under the second edition for logic in $name",
    async ({ source, line, column, snippet }) => {
      const loaded = await loadParsePort({
        peers: defaultTypeScriptPeers({
          installRoot: `${import.meta.dirname}/../../../../../..`,
          installForm: "source",
        }),
      });
      assert(loaded.outcome === "ok");
      const prepared = check.prepare({
        bindings: [SECOND_EDITION_BINDING],
        repository: REPOSITORY,
        syntaxApi: loaded.value.syntaxApi,
      });
      assert(prepared.outcome === "ok");

      const observed = observeWalkerFile({
        file: {
          file: FILE,
          readText: vi
            .fn<WalkerFile["readText"]>()
            .mockReturnValue({ outcome: "ok", value: source }),
        },
        pieces: [
          { modulePath: PIECE_ROOT, bindings: [SECOND_EDITION_BINDING], check: prepared.value },
        ],
        parse: loaded.value,
        escapes: [],
      });

      expect(observed).toEqual({
        outcome: "ok",
        value: {
          hits: [
            {
              file: FILE,
              check: ADDRESS,
              anchor: { line, column },
              snippet,
              remedy: PASSED_ON_FUNCTION_REMEDY,
            },
          ],
          nativeExceptions: [],
          applicable: [ADDRESS],
        },
      });
    },
  );

  it.each<SiteRow>(SECOND_EDITION_DOUBLE_SITES)(
    "names nothing under the first edition for second-edition logic in $name",
    async ({ source }) => {
      const loaded = await loadParsePort({
        peers: defaultTypeScriptPeers({
          installRoot: `${import.meta.dirname}/../../../../../..`,
          installForm: "source",
        }),
      });
      assert(loaded.outcome === "ok");
      const prepared = check.prepare({
        bindings: [FIRST_EDITION_BINDING],
        repository: REPOSITORY,
        syntaxApi: loaded.value.syntaxApi,
      });
      assert(prepared.outcome === "ok");

      const observed = observeWalkerFile({
        file: {
          file: FILE,
          readText: vi
            .fn<WalkerFile["readText"]>()
            .mockReturnValue({ outcome: "ok", value: source }),
        },
        pieces: [
          { modulePath: PIECE_ROOT, bindings: [FIRST_EDITION_BINDING], check: prepared.value },
        ],
        parse: loaded.value,
        escapes: [],
      });

      expect(observed).toEqual({
        outcome: "ok",
        value: { hits: [], nativeExceptions: [], applicable: [ADDRESS] },
      });
    },
  );

  it.each<RemediedSiteRow>(OUTSIDE_DOUBLE_SITES)(
    "names the construct's own fix for logic in $name",
    async ({ source, line, column, snippet, remedy }) => {
      const loaded = await loadParsePort({
        peers: defaultTypeScriptPeers({
          installRoot: `${import.meta.dirname}/../../../../../..`,
          installForm: "source",
        }),
      });
      assert(loaded.outcome === "ok");
      const prepared = check.prepare({
        bindings: [SECOND_EDITION_BINDING],
        repository: REPOSITORY,
        syntaxApi: loaded.value.syntaxApi,
      });
      assert(prepared.outcome === "ok");

      const observed = observeWalkerFile({
        file: {
          file: FILE,
          readText: vi
            .fn<WalkerFile["readText"]>()
            .mockReturnValue({ outcome: "ok", value: source }),
        },
        pieces: [
          { modulePath: PIECE_ROOT, bindings: [SECOND_EDITION_BINDING], check: prepared.value },
        ],
        parse: loaded.value,
        escapes: [],
      });

      expect(observed).toEqual({
        outcome: "ok",
        value: {
          hits: [{ file: FILE, check: ADDRESS, anchor: { line, column }, snippet, remedy }],
          nativeExceptions: [],
          applicable: [ADDRESS],
        },
      });
    },
  );
});

const RELEASED_OWN_API_CALLS = [
  {
    name: "a port method given an object",
    source: 'paths.join({ segments: ["a", "b"] });',
  },
  {
    name: "a repository lookup given an object",
    source: 'repository.find({ id: "a" });',
  },
  {
    name: "a query given an object",
    source: 'store.filter({ status: "open" });',
  },
  {
    name: "a method given more arguments than any built-in of its name takes",
    source: 'screen.keys("x", true, true);',
  },
  {
    name: "an entries method given an argument",
    source: "scenario.entries(output);",
  },
  {
    name: "a port imported from a relative module",
    source: 'import { paths } from "./paths.ts";\npaths.join({ segments: ["a"] });',
  },
  {
    name: "a port imported through a subpath import",
    source: 'import { paths } from "#src/paths.ts";\npaths.join({ segments: ["a"] });',
  },
  {
    name: "a port imported from a workspace package",
    source: 'import { paths } from "@app/paths";\npaths.join({ segments: ["a"] });',
  },
  {
    name: "a port loaded from a workspace package",
    source: 'const { paths } = await import("@app/paths");\npaths.join({ segments: ["a"] });',
  },
  {
    name: "a port built by a relative module's factory",
    source:
      'import { pathsOf } from "./paths.ts";\nconst paths = pathsOf();\npaths.join({ segments: ["a"] });',
  },
  {
    name: "a port held in an object literal beside a library",
    source:
      'import path from "node:path";\nconst deps = { path, paths: pathsOf() };\ndeps.paths.join({ segments: ["a"] });',
  },
  {
    name: "a port destructured from a fixture",
    source: 'const { paths } = harness();\npaths.join({ segments: ["a"] });',
  },
];

const FLAGGED_LOOK_ALIKES = [
  {
    name: "includes given an object",
    source: 'rows.includes({ id: "a" });',
    line: 1,
    column: 0,
    snippet: 'rows.includes({ id: "a" });',
    remedy: PICKING_METHOD_REMEDY,
  },
  {
    name: "indexOf given an object",
    source: 'rows.indexOf({ id: "a" });',
    line: 1,
    column: 0,
    snippet: 'rows.indexOf({ id: "a" });',
    remedy: PICKING_METHOD_REMEDY,
  },
  {
    name: "push given an object",
    source: 'rows.push({ id: "a" });',
    line: 1,
    column: 0,
    snippet: 'rows.push({ id: "a" });',
    remedy: MUTATING_METHOD_REMEDY,
  },
  {
    name: "concat given objects",
    source: 'rows.concat({ id: "a" }, { id: "b" });',
    line: 1,
    column: 0,
    snippet: 'rows.concat({ id: "a" }, { id: "b" });',
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "reduce given an object to start from",
    source: "rows.reduce(sum, { total: 0 });",
    line: 1,
    column: 0,
    snippet: "rows.reduce(sum, { total: 0 });",
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "with given an object",
    source: 'rows.with(0, { id: "a" });',
    line: 1,
    column: 0,
    snippet: 'rows.with(0, { id: "a" });',
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "splice given an object to insert",
    source: 'rows.splice(0, 1, { id: "a" });',
    line: 1,
    column: 0,
    snippet: 'rows.splice(0, 1, { id: "a" });',
    remedy: MUTATING_METHOD_REMEDY,
  },
  {
    name: "fill given an object",
    source: 'rows.fill({ id: "a" });',
    line: 1,
    column: 0,
    snippet: 'rows.fill({ id: "a" });',
    remedy: MUTATING_METHOD_REMEDY,
  },
  {
    name: "a Buffer search with an encoding",
    source: 'buffer.includes("x", 0, "utf8");',
    line: 1,
    column: 0,
    snippet: 'buffer.includes("x", 0, "utf8");',
    remedy: PICKING_METHOD_REMEDY,
  },
  {
    name: "Object.entries given an object",
    source: "Object.entries({ a: 1 });",
    line: 1,
    column: 0,
    snippet: "Object.entries({ a: 1 });",
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "Object.keys given a value",
    source: "Object.keys(value);",
    line: 1,
    column: 0,
    snippet: "Object.keys(value);",
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "join on node:path",
    source: 'import path from "node:path";\npath.join("a", "b", "c");',
    line: 2,
    column: 0,
    snippet: 'path.join("a", "b", "c");',
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "join on a namespace import of path",
    source: 'import * as path from "path";\npath.join("a", "b", "c");',
    line: 2,
    column: 0,
    snippet: 'path.join("a", "b", "c");',
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "join on a named import from node:path",
    source: 'import { posix } from "node:path";\nposix.join("a", "b", "c");',
    line: 2,
    column: 0,
    snippet: 'posix.join("a", "b", "c");',
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "join on a member of node:path",
    source: 'import path from "node:path";\npath.posix.join("a", "b", "c");',
    line: 2,
    column: 0,
    snippet: 'path.posix.join("a", "b", "c");',
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "a library helper given an object",
    source: 'import _ from "lodash";\n_.find(rows, { id: "a" }, 0, 1);',
    line: 2,
    column: 0,
    snippet: '_.find(rows, { id: "a" }, 0, 1);',
    remedy: PICKING_METHOD_REMEDY,
  },
  {
    name: "a string literal split by an object",
    source: '"a,b".split({ separator: "," });',
    line: 1,
    column: 0,
    snippet: '"a,b".split({ separator: "," });',
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "a port method given a variable",
    source: "paths.join(request);",
    line: 1,
    column: 0,
    snippet: "paths.join(request);",
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "a call that spreads its arguments",
    source: "screen.keys(...presses);",
    line: 1,
    column: 0,
    snippet: "screen.keys(...presses);",
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "a callback method given a callback",
    source: 'rows.find((row) => row.id === "a");',
    line: 1,
    column: 0,
    snippet: 'rows.find((row) => row.id === "a");',
    remedy: PICKING_METHOD_REMEDY,
  },
  {
    name: "join on node:path held in an object literal",
    source: 'import path from "node:path";\nconst deps = { path };\ndeps.path.join("a", "b", "c");',
    line: 3,
    column: 0,
    snippet: 'deps.path.join("a", "b", "c");',
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "join on node:path held under another name in an object literal",
    source:
      'import path from "node:path";\nconst deps = { files: path };\ndeps.files.join("a", "b", "c");',
    line: 3,
    column: 0,
    snippet: 'deps.files.join("a", "b", "c");',
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "find given an object as this",
    source: "rows.find(isA, {});",
    line: 1,
    column: 0,
    snippet: "rows.find(isA, {});",
    remedy: PICKING_METHOD_REMEDY,
  },
  {
    name: "map given an object as this",
    source: "rows.map(idOf, {});",
    line: 1,
    column: 0,
    snippet: "rows.map(idOf, {});",
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "some given an object with properties as this",
    source: "rows.some(isOpen, { strict: true });",
    line: 1,
    column: 0,
    snippet: "rows.some(isOpen, { strict: true });",
    remedy: PICKING_METHOD_REMEDY,
  },
  {
    name: "find on a property of this given an object as this",
    source: "this.rows.find(isA, {});",
    line: 1,
    column: 0,
    snippet: "this.rows.find(isA, {});",
    remedy: PICKING_METHOD_REMEDY,
  },
  {
    name: "find on an awaited value given an object as this",
    source: "(await load()).find(isA, {});",
    line: 1,
    column: 0,
    snippet: "(await load()).find(isA, {});",
    remedy: PICKING_METHOD_REMEDY,
  },
  {
    name: "split given a splitter object",
    source: "text.split({ [Symbol.split]: splitter });",
    line: 1,
    column: 0,
    snippet: "text.split({ [Symbol.split]: splitter });",
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "replace given a replacer object",
    source: 'text.replace({ [Symbol.replace]: replacer }, "b");',
    line: 1,
    column: 0,
    snippet: 'text.replace({ [Symbol.replace]: replacer }, "b");',
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "join on a member destructured from node:path",
    source: 'import path from "node:path";\nconst { posix } = path;\nposix.join("a", "b", "c");',
    line: 3,
    column: 0,
    snippet: 'posix.join("a", "b", "c");',
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "entries on an alias of Object",
    source: "const o = Object;\no.entries({ a: 1 });",
    line: 2,
    column: 0,
    snippet: "o.entries({ a: 1 });",
    remedy: COMPUTING_METHOD_REMEDY,
  },
  {
    name: "a library method on a value the library built",
    source:
      'import { z } from "zod";\nconst schema = z.string();\nschema.startsWith("x", { message: "m" });',
    line: 3,
    column: 0,
    snippet: 'schema.startsWith("x", { message: "m" });',
    remedy: COMPUTING_METHOD_REMEDY,
  },
];

describe("the walker on a listed method name that is the adopter's own API", () => {
  it.each<{ readonly name: string; readonly source: string }>(RELEASED_OWN_API_CALLS)(
    "names no form for $name",
    async ({ source }) => {
      const loaded = await loadParsePort({
        peers: defaultTypeScriptPeers({
          installRoot: `${import.meta.dirname}/../../../../../..`,
          installForm: "source",
        }),
      });
      assert(loaded.outcome === "ok");
      const prepared = check.prepare({
        bindings: [SECOND_EDITION_BINDING],
        repository: REPOSITORY,
        syntaxApi: loaded.value.syntaxApi,
      });
      assert(prepared.outcome === "ok");

      const observed = observeWalkerFile({
        file: {
          file: FILE,
          readText: vi
            .fn<WalkerFile["readText"]>()
            .mockReturnValue({ outcome: "ok", value: source }),
        },
        pieces: [
          { modulePath: PIECE_ROOT, bindings: [SECOND_EDITION_BINDING], check: prepared.value },
        ],
        parse: loaded.value,
        escapes: [],
      });

      expect(observed).toEqual({
        outcome: "ok",
        value: { hits: [], nativeExceptions: [], applicable: [ADDRESS] },
      });
    },
  );

  it.each<RemediedSiteRow>(FLAGGED_LOOK_ALIKES)(
    "still names a first-edition form for $name",
    async ({ source, line, column, snippet, remedy }) => {
      const loaded = await loadParsePort({
        peers: defaultTypeScriptPeers({
          installRoot: `${import.meta.dirname}/../../../../../..`,
          installForm: "source",
        }),
      });
      assert(loaded.outcome === "ok");
      const prepared = check.prepare({
        bindings: [FIRST_EDITION_BINDING],
        repository: REPOSITORY,
        syntaxApi: loaded.value.syntaxApi,
      });
      assert(prepared.outcome === "ok");

      const observed = observeWalkerFile({
        file: {
          file: FILE,
          readText: vi
            .fn<WalkerFile["readText"]>()
            .mockReturnValue({ outcome: "ok", value: source }),
        },
        pieces: [
          { modulePath: PIECE_ROOT, bindings: [FIRST_EDITION_BINDING], check: prepared.value },
        ],
        parse: loaded.value,
        escapes: [],
      });

      expect(observed).toEqual({
        outcome: "ok",
        value: {
          hits: [{ file: FILE, check: ADDRESS, anchor: { line, column }, snippet, remedy }],
          nativeExceptions: [],
          applicable: [ADDRESS],
        },
      });
    },
  );
});

describe("declarationsOf", () => {
  it("names each declaration of each bound name in source order, destructured and nested ones included", async () => {
    const loaded = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../../../../../..`,
        installForm: "source",
      }),
    });
    assert(loaded.outcome === "ok");
    const { syntaxApi } = loaded.value;
    const declarations = declarationsOf({
      syntaxApi,
      sourceFile: syntaxApi.createSourceFile(
        "form.test.ts",
        'const a = 1; const { b, c: [d] } = x; import e = require("e"); function f() { const a = 2; }',
        syntaxApi.ScriptTarget.Latest,
        true,
      ),
    });
    const declaredA = declarations.get("a");
    const declaredB = declarations.get("b");
    const declaredD = declarations.get("d");
    const declaredE = declarations.get("e");
    assert.isDefined(declaredA);
    assert.isDefined(declaredB);
    assert.isDefined(declaredD);
    assert.isDefined(declaredE);
    const [outerA, innerA] = declaredA;
    const [bindingB] = declaredB;
    const [bindingD] = declaredD;
    const [importE] = declaredE;
    assert.isDefined(outerA);
    assert.isDefined(innerA);
    assert.isDefined(bindingB);
    assert.isDefined(bindingD);
    assert.isDefined(importE);

    expect({
      names: declarations.size,
      a: [outerA.getText(), innerA.getText()],
      b: bindingB.getText(),
      d: bindingD.getText(),
      e: importE.getText(),
    }).toEqual({
      names: 4,
      a: ["a = 1", "a = 2"],
      b: "{ b, c: [d] } = x",
      d: "{ b, c: [d] } = x",
      e: 'import e = require("e");',
    });
  });
});
