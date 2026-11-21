# CD-10 checks

Symptoms: [Throw or catch in a test](../typescript/symptoms.md#throw-or-catch-in-a-test) and [Thrown non-error](../typescript/symptoms.md#thrown-non-error).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-10#throws-in-tests` | audit | a `throw` statement in a test file |
| `CD-10#throw-only-error` | eslint | a `throw` of something that is not an error object |

## What the check flags
- Test files only: `*.test.ts` and `*.test.tsx`. `*.spec.ts` and `.js` tests are not read. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Every `throw` statement, wherever it sits in the file.
- Allowed: assertion calls such as `expect(...)`.
- The source rule also confines throwing in production code to a closed list of contexts. The check does not look at production files; that part is left to review.

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../src/infrastructure/engines/eslint/CD-10/README.md).
- `hone-cd10/throw-only-error` flags a `throw` of a literal, an object literal, a binary expression, a template or tagged template, or `undefined`. It follows the thrown value through `a ? b : c`, `a || b`, assignment and sequence expressions.
- Allowed: `new Error(...)`, identifiers, calls and member access.
- This clause applies to every file the ESLint run includes, not only tests.

## Example violation
```ts
it("loads the account", () => {
  const result = load("a1");
  if (result.outcome === "failed") throw new Error("load failed");
});
```

## How to fix
```ts
it("loads the account", () => {
  expect(load("a1")).toEqual({ outcome: "ok", value: account });
});
```
Assert on the whole result. Branching in tests is also reported by CD-27.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. The form accepts an `authorised-location` for this clause, as for any; in spirit [Throw or catch in a test](../typescript/symptoms.md#throw-or-catch-in-a-test) has no correct use. See [discipline-exceptions.json](../../README.md#hone-records).

```json
{ "version": 1, "exceptions": [
  { "kind": "file-carve-out", "clause": "CD-10#throws-in-tests", "file": "src/legacy/charge.test.ts" }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`. [The exceptions format](../../README.md#hone-records) gives each shape.
