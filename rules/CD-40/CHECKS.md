# CD-40 checks

Symptom: [Positional parameters](../typescript/symptoms.md#positional-parameters).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-40#parameter-count` | eslint | a function with more than two parameters |
| `CD-40#named-object-argument` | review | the single argument is an object with named fields, not a positional scalar |

## What the check flags
- The ESLint piece lints whatever files the team's ESLint run includes. It needs ESLint adopted through the projection; see [the ESLint piece](../../src/infrastructure/engines/eslint/CD-40/README.md).
- Rule `hone-cd40/max-params`, which is typescript-eslint's `max-params` with `{ "max": 2, "countVoidThis": true }`.
- A function declaration, function expression, arrow function, method or constructor with more than two parameters. A `this` parameter counts.
- Not flagged by the check: functions with two or fewer parameters. The rule asks for one named object; a function with two parameters is left to review, where the function-first lens treats every authored function with two or more parameters as a candidate.
- `named-object-argument` is a judgement clause. It cannot be selected and is enforced by review.

## Example violation
```ts
const createOrder = (customerId: string, items: Item[], currency: string) => ({ customerId, items, currency });
```

## How to fix
```ts
const createOrder = ({ customerId, items, currency }: OrderRequest) => ({ customerId, items, currency });
```
Take one object with named fields so each call site reads as a labelled contract.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file must implement a callback signature fixed by an external library. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. Judgement clauses cannot be selected and need no exception record. See [discipline-exceptions.json](../../README.md#hone-records).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-40#parameter-count", "file": "src/adapters/vendor-callback.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`. [The exceptions format](../../README.md#hone-records) gives each shape.
