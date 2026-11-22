# test-body

```json
{}
```

Branching, `let`, and computing methods in a test file; edition 2 adds short-circuits, optional chaining, `switch` and computing namespace calls.

- **Misses:** a local `let` in production.
- **Settings traced to:** none.

## Flags
`CD-27#test-body-logic` has two editions. Edition 1 runs by default. Edition 2 adds the constructs below and becomes the default in the next major release; see [Settings](#settings) to run it now.

Edition 1:
- Test files only: `*.test.ts` and `*.test.tsx`. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- `if` statements, `try` statements, ternary expressions and `let` declarations.
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
