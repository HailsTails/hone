# non-null-assertions

```json
{
  "misses": "`any` reached through an outside dependency's types.",
  "settingsTracedTo": "`as const` allowed: Declared, not asserted."
}
```

A non-null assertion, `x!`, or a definite assignment assertion, `let x!: T` or `field!: T`.

## Flags
Needs ESLint adopted through the projection.
- Under ESLint, this is `no-restricted-syntax` with two selectors, one per form.
- `TSNonNullExpression` flags every non-null assertion, `x!`, wherever it sits: a read such as `user.name!`, a call such as `totals.get(key)!.toFixed(2)`, an assignment target such as `basket.total! = 0`. It is the same node typescript-eslint's `no-non-null-assertion` reports.
- `[definite=true]` flags every definite assignment assertion: `let total!: number` and a class field `balance!: number`.
- Each finding sits on the line where the asserted expression or the declared name starts.
- Allowed: logical not `!ready`, `!==`, an optional property `total?: number`, `??` fallbacks, and an initialised binding.
- There are no settings. No `audit` mechanism checks this clause, so a repository without ESLint lists it as `"not-run"`, and review owes it.

## Example
```ts
const user = response as User;
const name = user.name!;
```

## Fix
```ts
const user = userSchema.parse(response);
const name = user.name;
```
Parse or narrow the value so the type follows from a check rather than from an assertion. For a value that may be absent, handle the absent case with a check or an early return; for a binding assigned later, initialise it where it is declared or make it a `const` built from what it needs.

In a test file, [the test-body check](../branch-in-a-test/test-body.md) flags an `if` check at either edition, and its edition 2 flags the `??` fallback: read [Branch in a test](../branch-in-a-test.md) there.
