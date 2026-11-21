# CD-42 checks

Symptom: [Work inside a condition](../typescript/symptoms.md#work-inside-a-condition).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-42#useless-else` | eslint | an `else` after an `if` branch that always exits |

## What the check flags
- The ESLint piece lints whatever files the team's ESLint run includes. It needs ESLint adopted through the projection; see [the ESLint piece](../../src/infrastructure/engines/eslint/CD-42/README.md).
- Rule `hone-cd42/useless-else`: an `else` after an `if` branch that always exits is reported at the `else` keyword.
- A branch always exits when it ends in `return`, `throw`, `continue`, or `break` outside a switch. A nested `if` exits when both of its branches do. A `switch` exits when every non-empty case does.
- Along an `else if` chain whose earlier branches all exit, every `else` is reported.
- Allowed: an `else` after a branch that can fall through.

## Example violation
```ts
const label = (order: Order) => {
  if (order.cancelled) {
    return "cancelled";
  } else {
    return "active";
  }
};
```

## How to fix
```ts
const label = (order: Order) => {
  if (order.cancelled) return "cancelled";
  return "active";
};
```
Handle the unhappy path first with an early return and leave the happy path as the final return.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file must keep an else for an external reason. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. Judgement clauses cannot be selected and need no exception record. See [discipline-exceptions.json](../../README.md#hone-records).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-42#useless-else", "file": "src/legacy/status.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`. [The exceptions format](../../README.md#hone-records) gives each shape.
