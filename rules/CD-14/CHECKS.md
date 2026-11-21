# CD-14 checks

Symptoms: [Authored class or this](../typescript/symptoms.md#authored-class-or-this) and [Library class built in place](../typescript/symptoms.md#library-class-built-in-place).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-14#class-syntax` | audit or eslint | a class declaration or expression outside ambient code |
| `CD-14#static-only-class` | eslint | a class whose members are all static |
| `CD-14#library-construction` | review | library classes are built only in wrapping factories and never re-exported |

## What the check flags
- TypeScript source files; declaration files (`.d.ts`) are skipped. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped by the audit mechanism. The ESLint piece lints whatever files the team's ESLint run includes.
- Any class declaration, class expression, `abstract class`, nested class, or class inside a runtime `namespace`, reported at the `class` keyword.
- Allowed: `declare class`, classes inside `declare module`, `declare global` or `declare namespace`, and `new Client()` on a class imported from a library.
- `library-construction` is a judgement clause. It cannot be selected and is enforced by review.
- Other generated code can be left out of the audit mechanism's scope with `exclude` in disciplines.json. Hand-written classes are not out of scope.

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../src/infrastructure/engines/eslint/CD-14/README.md).
- `hone/no-extraneous-class` is typescript-eslint's `no-extraneous-class` with `allowConstructorOnly: true`, `allowEmpty: true`, `allowStaticOnly: false` and `allowWithDecorator: true`.
- It flags a class whose members are all static.
- Allowed: empty classes, decorated classes and classes that extend another class.

## Example violation
```ts
export class Counter {}
```

## How to fix
```ts
export const createCounter = () => {
  let count = 0;
  return { increment: () => (count += 1) };
};
```
Return an object of functions from a factory that closes over its state.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a class is required, such as an adapter extending a library base class. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. See [discipline-exceptions.json](../../README.md#hone-records).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-14#class-syntax", "file": "src/adapters/vendor-client.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`. [The exceptions format](../../README.md#hone-records) gives each shape.
