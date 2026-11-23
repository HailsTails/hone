# throw-statement

```json
{
  "misses": "`catch`.",
  "settingsTracedTo": "none."
}
```

A `throw` statement in a test file.

## Flags
- TypeScript files named `*.test.*` or `*.spec.*` with a `.ts`, `.tsx`, `.mts` or `.cts` extension. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Every `throw` statement, wherever it sits in the file.
- Allowed: assertion calls such as `expect(...)`.
- The [production throw check](../throw-between-our-units/throw-statement.md) covers other TypeScript source.

## Example
```ts
it("loads the account", () => {
  const result = load("a1");
  if (result.outcome === "failed") throw new Error("load failed");
});
```

## Fix
```ts
it("loads the account", () => {
  expect(load("a1")).toEqual({ outcome: "ok", value: account });
});
```
Assert on the whole result. Branching in tests is also reported by [the branch-in-a-test check](../branch-in-a-test/test-body.md).
