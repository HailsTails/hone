# CD-44 checks

Symptoms: [Write into a parameter](../typescript/symptoms.md#write-into-a-parameter) and [Rebinding](../typescript/symptoms.md#rebinding).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: how the rule is checked, and how to record an exception where the rule allows one.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-44#parameter-mutation` | audit | assignment to, deletion from or in-place methods on a parameter's fields |
| `CD-44#parameter-reassignment` | eslint | assigning to, incrementing or destructuring into a parameter itself |

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Inside a function declaration, function expression, arrow function or method, where the root name is one of its parameters (including destructured and outer-function parameters):
  - `parameter.field = value` and `parameter.a[0].b = value`
  - `delete parameter.field`
  - `parameter.push(...)`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`
- Not detected: reassigning the parameter, `+=` and `++`, `Map.set`, and mutation through an alias (`const copy = input; copy.x = 1`).

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../src/infrastructure/engines/eslint/CD-44/README.md).
- `hone-cd44/no-param-reassign` is ESLint's `no-param-reassign` with `{ "props": false }`.
- It flags assigning to a parameter, incrementing or decrementing it, and destructuring-assigning into it.
- A parameter's fields are not checked here; the audit's `parameter-mutation` clause covers them.

## Example violation
```ts
const addTotal = (order: Order) => {
  order.total = 10;
};
```

## How to fix
```ts
const withTotal = (order: Order): Order => ({ ...order, total: 10 });
```
Copy before sorting or reversing: `[...items].sort()`.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file must fill an output object supplied by an external API. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. See [discipline-exceptions.json](../../README.md#hone-records).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-44#parameter-mutation", "file": "src/adapters/legacy-writer.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`. [The exceptions format](../../README.md#hone-records) gives each shape.
