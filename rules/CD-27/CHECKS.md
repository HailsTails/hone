# CD-27 checks

Symptoms: [Branch in a test](../typescript/symptoms.md#branch-in-a-test), [Computed value in a test](../typescript/symptoms.md#computed-value-in-a-test), [Rebinding](../typescript/symptoms.md#rebinding), [Text past its reader](../typescript/symptoms.md#text-past-its-reader) and [Test switched off](../typescript/symptoms.md#test-switched-off). The test-logic check also sees the `let` form of [Answer set in a hook](../typescript/symptoms.md#answer-set-in-a-hook), and `try`, a form of [Throw or catch in a test](../typescript/symptoms.md#throw-or-catch-in-a-test).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-27#test-body-logic` | audit | branching, `let`, and computing methods in a test file; edition 2 adds short-circuits, optional chaining, `switch` and computing namespace calls |
| `CD-27#focused-tests` | eslint | `.only` on a test or suite, or `fdescribe`, `fit`, `ftest`, `fsuite` |
| `CD-27#skipped-tests` | eslint | `.skip` or `.fixme` on a test or suite, or `xdescribe`, `xit`, `xtest`, `xsuite` |

## What the check flags
`CD-27#test-body-logic` has two editions. Edition 1 runs by default. Edition 2 adds the constructs below and becomes the default in the next major release; see [Settings](#settings) to run it now.

Edition 1:
- Test files only: `*.test.ts` and `*.test.tsx`. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- `if` statements, `try` statements, ternary expressions and `let` declarations.
- A method call with a computing or mutating name, wherever it could be the string or array method of that name: `map`, `filter`, `reduce`, `find`, `forEach`, `join`, `slice`, `split`, `replace`, `includes`, `sort`, `trim`, `keys`, `values`, `push`, `pop`, `splice`, `fill` and similar string and array methods.
- Not flagged: a call with one of those names whose arguments no string or array method of that name accepts, which makes it the unit's own API. Either it passes an object literal where none of them takes an object, such as `paths.join({ segments: ["a", "b"] })`, or it passes more arguments than any of them takes, such as `screen.keys("x", true, true)`.
- Still flagged, though they look like that:
  - a call whose receiver traces back to a built-in namespace such as `Object` or `Math`, a package or `node:` module (imported, required or loaded with `import()`), or a string or array literal. The trace follows variables declared in the test file, including names destructured from a traced module or namespace, such as `posix` after `const { posix } = path`, and a property read directly off an object literal declared there, such as `deps.path` after `const deps = { path }`;
  - a call that spreads its arguments;
  - an object at a position where a string or array method takes one, such as `rows.includes({ id: "a" })`, `rows.push({ id: "a" })`, `rows.reduce(sum, { total: 0 })`, `rows.find(isA, {})` or `text.split({ [Symbol.split]: splitter })`.
- What this check cannot know: it reads names and syntax, not types, so it cannot tell what a receiver is.
  - It flags the unit's own method given a variable, such as `repository.find(query)`.
  - It misses a string or array method taken off its receiver before the call.
  - It does not trace a receiver that is a function parameter, an `it.each` row, a value from another module (even a relative module that re-exports a package), a name destructured from an object literal, or a property nested deeper in one, such as `deps.nested.path`; it reads these as the unit's own.
  - It releases a method of another built-in or library type that shares a name, such as a stream's `values` or `reduce`, when that call passes an object or more arguments than the string or array method takes.

  Only a check that reads types knows a receiver's identity, and Hone does not have one yet.
- Loops are not flagged here; CD-15 covers them. `throw` is CD-10.

Edition 2 also flags:
- `??`, `||` and `&&`, and their assignment forms `??=`, `||=` and `&&=`.
- Optional chaining: `a?.b`, `a?.[key]` and `f?.()`.
- `switch` statements.
- Computing calls on a built-in namespace: `JSON.stringify`, `JSON.parse`, `Object.assign`, `Object.fromEntries`, `Array.from` and any `Math` method. A finding on `JSON.stringify` or `JSON.parse` names [Serialising or parsing JSON](#serialising-or-parsing-json).

Neither edition flags element access such as `calls[0]`, calls to free functions, a method called through a computed key, such as `rows["map"]`, or text built with a template literal. Helper files that tests import are not checked; only the test files themselves are.

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../src/infrastructure/engines/eslint/CD-27/README.md).
- `hone-cd27/focused-tests` flags `.only` on a `describe`, `it`, `test` or `suite` chain, including `.only.each` and `test.describe.only`, and the bare names `fdescribe`, `fit`, `ftest` and `fsuite`. It reports at the `only` token.
- `hone-cd27/skipped-tests` flags `.skip` and `.fixme` on those chains, and the bare names `xdescribe`, `xit`, `xtest` and `xsuite`.
- Not flagged: `.todo`, `.concurrent` and `.each`.

## Settings
- `edition`: the edition this clause runs, `"1"` or `"2"`. Without it, the clause runs edition 1, or the latest edition when `checkEditions` in `disciplines.json` is `"latest"`.

```json
"clauseSettings": {
  "CD-27#test-body-logic": { "edition": "2" }
}
```

## Example violation
```ts
const expected = rows.map((row) => row.id);
```

## How to fix
```ts
expect(ids).toEqual(["a1", "b2"]);
```
Write the expected value out. A method call in the act step is flagged too, so move such logic into the unit under test.

Each finding ends with `fix:` and the page and section for what it flagged, such as `(node_modules/@hailstails/hone/rules/CD-27/CHECKS.md#an-optional-chain-after-an-index)`.

## Allowed forms in a test
Each section shows a flagged form first, then the forms to write instead. Every form to write instead passes every audit and ESLint clause Hone ships, at each edition its check declares, and compiles under the compiler options CD-3 requires. A test reads this page and holds every block on it to that. `assert`, `expect`, `it` and `vi` come from `vitest`, and a `declare const` line stands for the unit under test.

### Branching with if
```ts
declare const parse: (text: string) => { readonly outcome: "ok"; readonly value: string } | { readonly outcome: "failed" };
const parsed = parse("a");
if (parsed.outcome === "ok") {
  expect(parsed.value).toBe("a");
}
```
Compare the whole result:

```ts
declare const parse: (text: string) => { readonly outcome: "ok"; readonly value: string } | { readonly outcome: "failed" };
expect(parse("a")).toEqual({ outcome: "ok", value: "a" });
```

Or write one test per case, or one table:

```ts
declare const parse: (text: string) => { readonly outcome: "ok"; readonly value: string } | { readonly outcome: "failed" };
it.each([
  { text: "a", expected: { outcome: "ok", value: "a" } },
  { text: "", expected: { outcome: "failed" } },
])("parses $text", ({ text, expected }) => {
  expect(parse(text)).toEqual(expected);
});
```

### A try block
```ts
declare const load: (path: string) => string;
try {
  load("missing.json");
} catch (error) {
  expect(error).toBeInstanceOf(Error);
}
```
Assert the throw:

```ts
declare const load: (path: string) => string;
expect(() => load("missing.json")).toThrow(Error);
```

```ts
declare const loadLater: (path: string) => Promise<string>;
it("refuses a missing file", async () => {
  await expect(loadLater("missing.json")).rejects.toThrow(Error);
});
```

### A ternary
```ts
declare const discountFor: (customer: { readonly tier: "premium" | "standard" }) => number;
const tier = "premium";
expect(discountFor({ tier })).toBe(tier === "premium" ? 10 : 0);
```
Write the value out, with one table row per case:

```ts
declare const discountFor: (customer: { readonly tier: "premium" | "standard" }) => number;
it.each([
  { tier: "premium", expected: 10 },
  { tier: "standard", expected: 0 },
] as const)("gives $expected off to a $tier customer", ({ tier, expected }) => {
  expect(discountFor({ tier })).toBe(expected);
});
```

### A let
```ts
declare const record: (store: { readonly save: (text: string) => void }) => void;
let saved = "";
record({ save: (text) => { saved = text; } });
expect(saved).toBe("a");
```
Record the calls with `vi.fn` and assert them:

```ts
declare const record: (store: { readonly save: (text: string) => void }) => void;
const save = vi.fn<(text: string) => void>();
record({ save });
expect(save).toHaveBeenCalledWith("a");
```

### A method that picks or tests an element
```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
expect(listTasks().find((task) => task.id === "a")).toEqual({ id: "a", status: "open" });
```
Assert on the whole array:

```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
expect(listTasks()).toContainEqual({ id: "a", status: "open" });
```

```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
expect(listTasks()).toEqual(expect.arrayContaining([expect.objectContaining({ id: "a" })]));
```

The check cannot tell the unit's own method with one of these names from an array method when it is given a variable, such as `repository.find(query)`. That is a limit of the check, described under [What the check flags](#what-the-check-flags).

### A method that computes a value
```ts
declare const idsOf: (rows: readonly { readonly id: string }[]) => readonly string[];
const rows = [{ id: "a1" }, { id: "b2" }];
expect(idsOf(rows)).toEqual(rows.map((row) => row.id));
```
Write the expected value out:

```ts
declare const idsOf: (rows: readonly { readonly id: string }[]) => readonly string[];
expect(idsOf([{ id: "a1" }, { id: "b2" }])).toEqual(["a1", "b2"]);
```

Or match the part that matters:

```ts
declare const receiptOf: (order: { readonly total: number }) => { readonly total: number; readonly label: string };
expect(receiptOf({ total: 30 })).toMatchObject({ label: expect.stringContaining("30") });
```

### A method that mutates
```ts
declare const namesOf: (team: string) => readonly string[];
const expected = ["Ada"];
expected.push("Grace");
expect(namesOf("core")).toEqual(expected);
```
Write the finished array out:

```ts
declare const namesOf: (team: string) => readonly string[];
expect(namesOf("core")).toEqual(["Ada", "Grace"]);
```

### A short-circuit
```ts
declare const lookup: (id: string) => { readonly name: string } | undefined;
const found = lookup("a");
expect(found !== undefined && found.name === "Ada").toBe(true);
```
Write the value a fallback gives. To narrow a value that may be missing, assert it is defined, then read it:

```ts
declare const lookup: (id: string) => { readonly name: string } | undefined;
const found = lookup("a");
assert.isDefined(found);
expect(found.name).toBe("Ada");
```

### An optional chain after an index
```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
expect(listTasks()[0]?.id).toBe("a");
```
Compare the whole element:

```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
expect(listTasks()[0]).toMatchObject({ id: "a" });
```

Or destructure it and assert it is defined before reading it:

```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
const [first] = listTasks();
assert.isDefined(first);
expect(first.id).toBe("a");
```

### An optional chain on a mock call
```ts
declare const start: (run: (task: { readonly id: string }) => void) => void;
const run = vi.fn<(task: { readonly id: string }) => void>();
start(run);
expect(run.mock.calls[0]?.[0].id).toBe("a");
```
Assert that call by its position:

```ts
declare const start: (run: (task: { readonly id: string }) => void) => void;
const run = vi.fn<(task: { readonly id: string }) => void>();
start(run);
expect(run).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: "a" }));
```

Reading `run.mock.lastCall?.[0]` names this section too. Assert the last call:

```ts
declare const start: (run: (task: { readonly id: string }) => void) => void;
const run = vi.fn<(task: { readonly id: string }) => void>();
start(run);
expect(run).toHaveBeenLastCalledWith({ id: "a" });
```

### An optional chain on a mock result
```ts
declare const pricing: { readonly priceOf: (amount: number) => number };
declare const settle: (prices: { readonly priceOf: (amount: number) => number }) => void;
const priceOf = vi.spyOn(pricing, "priceOf");
settle(pricing);
expect(priceOf.mock.results[0]?.value).toBe(4);
```
Assert what that call returned, by its position:

```ts
declare const pricing: { readonly priceOf: (amount: number) => number };
declare const settle: (prices: { readonly priceOf: (amount: number) => number }) => void;
const priceOf = vi.spyOn(pricing, "priceOf");
settle(pricing);
expect(priceOf).toHaveNthReturnedWith(1, 4);
```

`toHaveLastReturnedWith` asserts what the last call returned.

An optional chain on `mock.instances` or `mock.contexts` names [An optional chain after an index](#an-optional-chain-after-an-index).

### An optional chain on a property
```ts
declare const findUser: (id: string) => { readonly name: string } | undefined;
expect(findUser("a")?.name).toBe("Ada");
```
Compare the whole value:

```ts
declare const findUser: (id: string) => { readonly name: string } | undefined;
expect(findUser("a")).toMatchObject({ name: "Ada" });
```

Or assert it is defined before reading it:

```ts
declare const findUser: (id: string) => { readonly name: string } | undefined;
const user = findUser("a");
assert.isDefined(user);
expect(user.name).toBe("Ada");
```

### An optional call
```ts
declare const observers: { readonly enter?: (node: string) => void };
observers.enter?.("a");
```
Destructure the function, assert it is defined, then call it:

```ts
declare const observers: { readonly enter?: (node: string) => void };
const { enter } = observers;
assert.isDefined(enter);
enter("a");
```

A method that reads `this` loses it once taken off its object, so assert it is defined where it is and call it there:

```ts
declare const tracker: { readonly entered: readonly string[]; enter?(node: string): void };
assert.isDefined(tracker.enter);
tracker.enter("a");
```

### A switch
```ts
declare const areaOf: (shape: { readonly kind: "square"; readonly side: number } | { readonly kind: "circle"; readonly radius: number }) => number;
const shape = { kind: "square", side: 2 } as const;
switch (shape.kind) {
  case "square":
    expect(areaOf(shape)).toBe(4);
}
```
Write one test per case, or one table:

```ts
declare const areaOf: (shape: { readonly kind: "square"; readonly side: number } | { readonly kind: "circle"; readonly radius: number }) => number;
it.each([
  { shape: { kind: "square", side: 2 } as const, expected: 4 },
  { shape: { kind: "circle", radius: 0 } as const, expected: 0 },
])("measures a $shape.kind", ({ shape, expected }) => {
  expect(areaOf(shape)).toBe(expected);
});
```

### Serialising or parsing JSON
```ts
declare const render: (row: { readonly id: string }) => string;
expect(JSON.parse(render({ id: "a" }))).toEqual({ id: "a" });
```
A finding on `JSON.stringify` or `JSON.parse` names this section. Assert the object the unit gives back, written out:

```ts
declare const rowOf: (row: { readonly id: string }) => { readonly id: string };
expect(rowOf({ id: "a" })).toEqual({ id: "a" });
```

A unit that gives back only text should hand over an object, leaving the text to the adapter at its edge.

### Merging objects
```ts
const base = { method: "POST", path: "/tasks" } as const;
const request = Object.assign({}, base, { body: "a" });
expect(request.body).toBe("a");
```
Write the object out, spreading what it copies:

```ts
const base = { method: "POST", path: "/tasks" } as const;
const request = { ...base, body: "a" };
expect(request.body).toBe("a");
```

A spread copies an `Error`'s own properties into a plain object, which is not an `Error`. To give an `Error` a property, assign it:

```ts
declare const reasonOf: (error: Error & { readonly code?: string }) => string;
const missing: Error & { code?: string } = new Error("ENOENT");
missing.code = "ENOENT";
expect(reasonOf(missing)).toBe("missing");
```

### Building an object from entries
```ts
declare const countsOf: (words: readonly string[]) => Readonly<Record<string, number>>;
expect(countsOf(["a"])).toEqual(Object.fromEntries([["a", 1]]));
```
Write the object out:

```ts
declare const countsOf: (words: readonly string[]) => Readonly<Record<string, number>>;
expect(countsOf(["a"])).toEqual({ a: 1 });
```

### Building an array from a length
```ts
declare const pageOf: (rows: readonly { readonly id: number }[]) => readonly { readonly id: number }[];
expect(pageOf(Array.from({ length: 3 }, (_, index) => ({ id: index })))).toHaveLength(3);
```
Write a short array out:

```ts
declare const pageOf: (rows: readonly { readonly id: number }[]) => readonly { readonly id: number }[];
expect(pageOf([{ id: 0 }, { id: 1 }, { id: 2 }])).toHaveLength(3);
```

An array too long to read written out, such as one row past a page size of 1,000, has no form on this page.

### A Math call
```ts
declare const roundedOf: (amount: number) => number;
expect(roundedOf(2.5)).toBe(Math.round(2.5));
```
Write the number out:

```ts
declare const roundedOf: (amount: number) => number;
expect(roundedOf(2.5)).toBe(3);
```

### Logic inside a function the test passes on
```ts
declare const isInstalled: (fileKind: { readonly kindOf: (path: string) => "file" | "missing" }) => "installed" | "missing";
const installedFiles = ["bin/hone.js"];
expect(isInstalled({ kindOf: (path) => (installedFiles.includes(path) ? "file" : "missing") })).toBe("installed");
```
A function a test writes as a property or method of an object literal, or gives to `vi.fn` or `mockImplementation`, is passed on: to the unit, to a table row, or to a double. Any flagged construct inside it names this section. Make it a `vi.fn` spy with a written-out return, and write out what it was asked:

```ts
declare const isInstalled: (fileKind: { readonly kindOf: (path: string) => "file" | "missing" }) => "installed" | "missing";
const kindOf = vi.fn<(path: string) => "file" | "missing">().mockReturnValue("file");
expect(isInstalled({ kindOf })).toBe("installed");
expect(kindOf).toHaveBeenCalledExactlyOnceWith("bin/hone.js");
```

The recipe is [Stub with vi.fn](../typescript/recipes.md#stub-with-vifn).

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. The form accepts an `authorised-location` for this clause, as for any; in spirit [Branch in a test](../typescript/symptoms.md#branch-in-a-test) and [Computed value in a test](../typescript/symptoms.md#computed-value-in-a-test) have no correct use. See [discipline-exceptions.json](../../README.md#hone-records).

```json
{ "version": 1, "exceptions": [
  { "kind": "file-carve-out", "clause": "CD-27#test-body-logic", "file": "src/legacy/report.test.ts" }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`. [The exceptions format](../../README.md#hone-records) gives each shape.
