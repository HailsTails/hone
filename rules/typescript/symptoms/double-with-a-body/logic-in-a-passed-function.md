# logic-in-a-passed-function

```json
{}
```

Branching, `let`, and computing methods in a test file; edition 2 adds short-circuits, optional chaining, `switch` and computing namespace calls.

- **Misses:** hand-written doubles.
- **Settings traced to:** test file is `.test.ts(x)`: Companion test file recipe.

## Flags
`CD-27#test-body-logic` has two editions. Edition 1 runs by default. Edition 2 adds the constructs below and becomes the default in the next major release; see [Settings](#settings) to run it now.

Edition 1:
- Test files only: `*.test.ts` and `*.test.tsx`. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Loops are not flagged here; [loop-statement](../loop-keyword/loop-statement.md) covers them. `throw` is [throw-statement](../throw-or-catch-in-a-test/throw-statement.md).

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

The recipe is [Stub with vi.fn](../../recipes/stub-with-vifn.md).
