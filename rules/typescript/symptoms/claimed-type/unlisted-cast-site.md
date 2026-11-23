# unlisted-cast-site

```json
{
  "misses": "`any` reached through an outside dependency's types.",
  "settingsTracedTo": "`as const` allowed: Declared, not asserted."
}
```

A type assertion that is not on the permitted list.

## Flags
- `.ts`, `.tsx`, `.mts` and `.cts` files, and `.js`, `.jsx`, `.mjs` and `.cjs` files the compiler checks: under `// @ts-check`, or with `checkJs` on in the nearest `tsconfig.json`. A nearest `tsconfig.json` that does not resolve stops the check on the JavaScript files under it with an error. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Every `x as T` and `<T>x` assertion, and in JavaScript every `/** @type {T} */ (x)`, except a const assertion, `as const`, `<const>x` or `/** @type {const} */ (x)`. Assertions whose type contains `any` are [cast-to-any](cast-to-any.md)'s and are not repeated here.
- `as unknown` and `<unknown>x` are flagged. Widening never needs an assertion: annotate instead, `const parsed: unknown = JSON.parse(text)`.
- A cast through `unknown`, such as `raw as unknown as User`, `(<unknown>raw) as User` or one wrapped in `!` or `satisfies`, is flagged with its own message, and so is its `unknown` half. It is the escape hatch that turns any value into any type; check the value's shape at runtime at the boundary instead.
- `@ts-expect-error`, `@ts-ignore` and `@ts-nocheck` in the files this clause checks are reported as `inline-disable` native exceptions of this clause, where the compiler honours them and whether or not they hide a cast. Each is a finding in its file: a debt or an authorised location on the file covers it, and a tracked reference on the comment ([directive-pointers](../untracked-escape/directive-pointers.md)) does not stand in for the record.
- Test files, test helpers and scripts are checked like any other source; a test that needs a cast needs a typed stub or a narrower port.
- There are no settings: a boundary that forces a cast is an exception record, as below.

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

When handing a value across a boundary truly forces a cast, such as a library that types its schemas loosely or a database driver that returns unparsed rows, put the cast in the one adapter file at that boundary and record that file as an `authorised-location` with a why-chain. With clean boundaries that is one file and one record; casts scattered across many files are the sign the boundary is missing.
