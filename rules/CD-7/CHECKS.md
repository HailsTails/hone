# CD-7 checks

Symptoms: [Drawer path](../typescript/symptoms.md#drawer-path) and [Name off its casing](../typescript/symptoms.md#name-off-its-casing).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-7#categorical-paths` | audit | a forbidden file name or folder name in a path |
| `CD-7#filename-case` | eslint | a file name that is not kebab-case or PascalCase |

## What the check flags
- `.ts` and `.tsx` files only, judged by path; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- File names, exactly and in lower case, with a `.ts` extension: `types.ts interfaces.ts models.ts enums.ts utils.ts util.ts helpers.ts helper.ts common.ts lib.ts misc.ts shared.ts`.
- Any folder in the path named `utils`, `helpers`, `common`, `lib`, `misc`, `shared`, `scripts`, `values`, `tests`, `test` or `__tests__`. Each file under such a folder is reported once for the folder.
- Allowed: `account-types.ts`, `Types.ts` and `types.tsx`, which are not exact matches.

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../src/infrastructure/engines/eslint/CD-7/README.md).
- `hone-cd7/filename-case` checks the file name before its first dot, after trimming edge `_`: it must be kebab-case or PascalCase. Each later dot segment must be kebab-case, PascalCase or lowercase.
- One leading `.`, `+` or `$` is ignored.
- Route names such as `[slug].ts` and `(group).ts` pass.
- A bad name is reported at line 1.

## Example violation
```text
src/helpers.ts
src/utils/format-price.ts
```

## How to fix
```text
src/price-formatting.ts
```
Rename the file or folder for what it contains, or split it into files that each hold one thing.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a path name is fixed by a framework or external convention. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. See [discipline-exceptions.json](../../README.md#hone-records).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-7#categorical-paths", "file": "utils/format-price.ts", "reason": "Nuxt auto-imports from the utils directory, so the folder name is fixed by the framework" }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`. [The exceptions format](../../README.md#hone-records) gives each shape.
