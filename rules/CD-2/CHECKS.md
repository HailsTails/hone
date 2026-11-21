# CD-2 checks

Symptom: [Claimed type](../typescript/symptoms.md#claimed-type).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-2#cast-expressions` | audit | a type assertion that is not on the permitted list |
| `CD-2#non-null-assertions` | eslint | a non-null assertion, `x!`, or a definite assignment assertion, `let x!: T` or `field!: T` |

## What the check flags
- `.ts` and `.tsx` files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Every `x as T` and `<T>x` assertion except a const assertion, `as const` or `<const>x`. Assertions whose type contains `any` are CD-1's and are not repeated here.
- `as unknown` and `<unknown>x` are flagged. Widening never needs an assertion: annotate instead, `const parsed: unknown = JSON.parse(text)`.
- A cast through `unknown`, such as `raw as unknown as User`, `(<unknown>raw) as User` or one wrapped in `!` or `satisfies`, is flagged with its own message, and so is its `unknown` half. It is the escape hatch that turns any value into any type; check the value's shape at runtime at the boundary instead.
- `@ts-expect-error`, `@ts-ignore` and `@ts-nocheck` in the `.ts` and `.tsx` files this clause checks are reported as `inline-disable` native exceptions of this clause, where the compiler honours them and whether or not they hide a cast. Directives in `.mts`, `.cts` and JavaScript files are not read. Each is debt on this clause in its file: an `authorised-location` or `file-carve-out` on the file covers it, a `clause-wide-carve-out` does not, and a tracked reference on the comment (CD-5) does not stand in for the record.
- Test files, test helpers and scripts are checked like any other source; a test that needs a cast needs a typed stub or a narrower port.
- There are no settings: a boundary that forces a cast is an exception record, as below.

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../src/infrastructure/engines/eslint/CD-2/README.md).
- `hone-cd2/no-restricted-syntax` is ESLint's `no-restricted-syntax` with two selectors, one per form.
- `TSNonNullExpression` flags every non-null assertion, `x!`, wherever it sits: a read such as `user.name!`, a call such as `totals.get(key)!.toFixed(2)`, an assignment target such as `basket.total! = 0`. It is the same node typescript-eslint's `no-non-null-assertion` reports.
- `[definite=true]` flags every definite assignment assertion: `let total!: number` and a class field `balance!: number`.
- Each finding sits on the line where the asserted expression or the declared name starts.
- Allowed: logical not `!ready`, `!==`, an optional property `total?: number`, `??` fallbacks, and an initialised binding.
- There are no settings. No `audit` mechanism checks this clause, so a repository without ESLint lists it as `"not-run"`, and review owes it.

## Example violation
```ts
const user = response as User;
const name = user.name!;
```

## How to fix
```ts
const user = userSchema.parse(response);
const name = user.name;
```
Parse or narrow the value so the type follows from a check rather than from an assertion. For a value that may be absent, handle the absent case with a check or an early return; for a binding assigned later, initialise it where it is declared or make it a `const` built from what it needs.

In a test file, `CD-27#test-body-logic` flags an `if` check at either edition, and its edition 2 flags the `??` fallback: there, `assert.isDefined` a value that may be missing before reading it, as [CD-27's allowed forms](../CD-27/CHECKS.md#a-short-circuit) show.

When handing a value across a boundary truly forces a cast, such as a library that types its schemas loosely or a database driver that returns unparsed rows, put the cast in the one adapter file at that boundary and record that file as an `authorised-location` with a why-chain. With clean boundaries that is one file and one record; casts scattered across many files are the sign the boundary is missing.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file sits on an external boundary that forces an assertion, such as an adapter. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. See [discipline-exceptions.json](../../README.md#hone-records).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-2#cast-expressions", "file": "src/adapters/row-reader.ts", "reason": "..." }
] }
```

Records on `CD-2#non-null-assertions` take the same kinds. Existing `!` debt is usually a `file-carve-out` per file, or one `clause-wide-carve-out` while an assessment's steps pay it down. An `eslint-disable` naming `hone-cd2/no-restricted-syntax`, or naming no rule, is held only by an `authorised-location` or `file-carve-out` on this clause and its file; a `clause-wide-carve-out` does not hold it. The projection carries every record for it, so run `hone project` after recording one.

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`. [The exceptions format](../../README.md#hone-records) gives each shape.
