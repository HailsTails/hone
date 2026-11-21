# CD-6 checks

Symptoms: [Shorthand name](../typescript/symptoms.md#shorthand-name) and [Name off its casing](../typescript/symptoms.md#name-off-its-casing).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-6#identifier-names` | audit | a binding named from a fixed shorthand or filler list |
| `CD-6#naming-convention` | eslint | a name that breaks the naming convention for its kind |

## What the check flags
- `.ts` and `.tsx` files, including tests; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- The declared name of a variable, a parameter, a named function declaration or a destructured binding, when the whole name is exactly one of these (case-sensitive):
  - shorthand: `c op s cb fn tx e ev acc item k v el arr i j n obj val res req tmp temp`
  - filler: `object obj args arguments details extra extras data info params parameters props payload body value result stuff things misc metadata`
- Allowed: longer names that contain these words (`accountData`), names starting with `_`, property keys and property accesses.
- Other poor names (`manager`, `handler`, vague nouns) are left to review.

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../src/infrastructure/engines/eslint/CD-6/README.md).
- `hone-cd6/naming-convention` is typescript-eslint's `naming-convention` with the option list in the piece's `piece.json`.
- Enum members are CONSTANT_CASE. `const` bindings are CONSTANT_CASE, camelCase or PascalCase.
- Object literal properties are camelCase. Type properties are camelCase or PascalCase.
- Other variables, functions and parameters are camelCase or PascalCase; a leading or trailing `_` or `$` is allowed.
- Types are PascalCase. Class members are camelCase, and static ones may also be CONSTANT_CASE.
- Consecutive capitals are allowed (`agentID`, `HTTPServer`).
- Ignored: names that need quotes, destructured bindings, imports and unused bindings whose name starts with `_`.
- Not checked, unlike Biome: the local name of a renamed named import (`import { a as b }`) and a `catch` parameter. typescript-eslint has no selector for either; review covers them.

## Example violation
```ts
const data = await loadAccount(id);
```

## How to fix
```ts
const account = await loadAccount(id);
```
Name the value for what it is in the domain.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file must keep a name fixed by an external contract. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. See [discipline-exceptions.json](../../README.md#hone-records).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-6#identifier-names", "file": "src/adapters/legacy-feed.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`. [The exceptions format](../../README.md#hone-records) gives each shape.
