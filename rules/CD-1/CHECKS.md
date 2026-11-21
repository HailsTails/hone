# CD-1 checks

Symptoms: [Claimed type](../typescript/symptoms.md#claimed-type) and [Untyped value](../typescript/symptoms.md#untyped-value).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-1#any-cast` | audit | a type assertion whose type contains `any` |
| `CD-1#explicit-any` | eslint | an `any` type anywhere in a type position |
| `CD-1#implicit-any-let` | eslint | a `let` or `var` with neither a type annotation nor an initialiser |

## What the check flags
- `.ts` and `.tsx` files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A type assertion (`x as T` or `<T>x`) whose type contains the `any` keyword at any depth: `as any`, `<any>x`, `as Array<any>`, `as Record<string, any>`, `as Map<string, any>` or `as { field: any }`. The check reads the syntax tree, so an `any` elsewhere on the line is not attributed to the cast.
- CD-1 judges these before CD-2 and has no settings; every other assertion is CD-2's.
- A bare annotation such as `let value: any` is not flagged by this clause; `CD-1#explicit-any` covers it.

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../src/infrastructure/engines/eslint/CD-1/README.md).
- `hone-cd1/no-explicit-any` is typescript-eslint's `no-explicit-any` with default options. It flags every `any` type: annotations, type arguments such as `Map<string, any>`, and `as any`.
- `hone-cd1/implicit-any-let` flags a `let` or `var` declaration in a `.ts` or `.tsx` file that has neither a type annotation nor an initialiser, one report per declaration at its first such binding. Declaration files (`.d.ts`), `const`, and `for-in` and `for-of` heads are not flagged.
- Allowed: `unknown`, `let total = 0` and `let total: number`.

## Example violation
```ts
const parsed = JSON.parse(text) as any;
```

## How to fix
```ts
const order = orderSchema.parse(JSON.parse(text));
```
Give it a concrete type where it enters: parse it once with a schema in the adapter for whoever produced it, checked at runtime.

In a test file, edition 2 of `CD-27#test-body-logic` flags `JSON.parse`; edition 1, the default, does not.

## Exceptions
CD-1 is exempted like any other discipline: record an `authorised-location`, a `file-carve-out` for existing debt, or a clause-wide carve-out in `discipline-exceptions.json`. A carved or authorised file keeps its existing `any`; an `any` anywhere else still fails. See [discipline-exceptions.json](../../README.md#hone-records).
