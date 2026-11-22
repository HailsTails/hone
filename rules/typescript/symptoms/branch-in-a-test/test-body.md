# test-body

```json
{
  "flagsBeyondTheSymptom": "unit's own API (edition 1).",
  "settingsTracedTo": "the edition: backwards compatibility for adopters since the npm release."
}
```

Branching, `let`, and computing methods in a test file; edition 2 adds short-circuits, optional chaining, `switch` and computing namespace calls.

## Flags
`CD-27#test-body-logic` has two editions. Edition 1 runs by default. Edition 2 adds the constructs below and becomes the default in the next major release; see [Settings](#settings) to run it now.

Edition 1:
- Test files only: `*.test.ts` and `*.test.tsx`. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- `if` statements, `try` statements, ternary expressions and `let` declarations.
- Loops are not flagged here; [loop-statement](../loop-keyword/loop-statement.md) covers them. `throw` is [throw-statement](../throw-or-catch-in-a-test/throw-statement.md).

Edition 2 also flags:
- `??`, `||` and `&&`, and their assignment forms `??=`, `||=` and `&&=`.
- Optional chaining: `a?.b`, `a?.[key]` and `f?.()`.
- `switch` statements.

Neither edition flags element access such as `calls[0]`, calls to free functions, a method called through a computed key, such as `rows["map"]`, or text built with a template literal. Helper files that tests import are not checked; only the test files themselves are.

## Settings
- `edition`: the edition this clause runs, `"1"` or `"2"`. Without it, the clause runs edition 1, or the latest edition when `checkEditions` in `disciplines.json` is `"latest"`.

```jsonc
"clauseSettings": {
  "CD-27#test-body-logic": { "edition": "2" }
}
```

## Allowed forms in a test
Each section shows a flagged form first, then the forms to write instead. Every form to write instead passes every audit and ESLint clause Hone ships, at each edition its check declares, and compiles under the compiler options [strictness-weakened](../strictness-weakened.md) requires. A test reads this page and holds every block on it to that. `assert`, `expect`, `it` and `vi` come from `vitest`, and a `declare const` line stands for the unit under test.

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
