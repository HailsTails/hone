# CD-41 checks

Symptoms: [Long function](../typescript/symptoms.md#long-function), [Tangled function](../typescript/symptoms.md#tangled-function) and [Orchestrator that computes](../typescript/symptoms.md#orchestrator-that-computes).

Read [the verdict and the named pages it points at](README.md) first. This page is the mechanics: what each check flags and misses, how to fix a flagged site, and how to record an exception.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-41#cognitive-complexity` | eslint | a function whose cognitive complexity is above 15 |
| `CD-41#function-length` | eslint | a function body longer than 50 lines |
| `CD-41#orchestration-only` | review | an orchestrator only composes helper calls and assembles their results |

## What the check flags
- The ESLint piece lints whatever files the team's ESLint run includes. It needs ESLint adopted through the projection; see [the ESLint piece](../../src/infrastructure/engines/eslint/CD-41/README.md).
- `hone-cd41/cognitive-complexity`: each function's cognitive complexity must be at most 15.
  - An `if`, `else if`, `switch`, ternary, `catch` and each loop adds 1 plus the current nesting depth.
  - An `else`, a `finally`, a labelled `break` or `continue`, and each run of the same logical operator add 1.
  - Nesting deepens inside `if`, loops, `switch`, `catch` and ternaries.
  - A nested function is scored on its own, starting one level deeper, and its score is not added to its parent.
  - Reported at the function's name.
- `hone-cd41/function-length`: a function body may span at most 50 lines. Blank and comment lines count; lines holding only `{` or `}` do not. Getters and setters are not checked. Reported at the function.
  - A test suite's body is not checked. A suite body is a function passed as an argument to the call that runs a suite:
    - `describe`, `suite`, `fdescribe`, `xdescribe`, `fsuite` or `xsuite`, alone or followed only by the modifiers `each`, `for`, `only`, `skip`, `todo`, `concurrent`, `sequential`, `shuffle`, `skipIf` and `runIf`, such as `describe.each(table)(name, fn)`, `describe.each` with a template table, `describe.only.each(table)(name, fn)` or `describe.skipIf(condition)(name, fn)`;
    - Playwright's `test.describe`, alone or followed only by `only`, `skip`, `fixme`, `serial` and `parallel`, such as `test.describe.serial.only(name, fn)`.
  - A suite nested in a suite is not checked either.
  - Everything else is checked as any function is:
    - each function inside a suite's body: each `it` and `test` callback, each hook and each helper declared there;
    - a function given to `describe.each` as a table entry;
    - a callback on any other member of those names, such as `test.describe.configure(fn)` or `suite.add(name, fn)` on a benchmark suite;
    - mocha's `context`, and any other suite function not listed above.
  - The check matches names, not bindings, so a local function of the repository's own named `describe` or `suite` is treated as a suite when called that way.
- `orchestration-only` is a judgement clause. It cannot be selected and is enforced by review.

## Example violation
```ts
const settle = (orders: Order[]) => {
  for (const order of orders) {
    if (order.paid) {
      for (const line of order.lines) {
        if (line.refundable && line.quantity > 0) {
          refund(line);
        }
      }
    }
  }
};
```

## How to fix
```ts
const settle = (orders: Order[]) => orders.filter(isPaid).forEach(refundEligibleLines);
```
Move any computing or branching between calls into a named doer, so the orchestrator only composes calls.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file holds a function whose shape is fixed by an external contract. Use `file-carve-out` for debt in one file: it is forfeited once the file is touched, and needs no `whyChain`. Judgement clauses cannot be selected and need no exception record. See [discipline-exceptions.json](../../README.md#hone-records).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-41#cognitive-complexity", "file": "src/legacy/tax-engine.ts", "reason": "..." }
] }
```

An `authorised-location` or `clause-wide-carve-out` also needs a `whyChain` that follows the [why-chain contract](../../docs/why-chain-contract.md): five whys chained cause to cause, a `rootCause`, its `rootCheck`, a `readback` and an `owner`. A record imported from an earlier system carries `provenance` instead. A `file-carve-out` is debt and needs only its `kind`, `clause` and `file`; its `reason` is an optional note, and a `whyChain` or `provenance` it gives anyway is still judged. With `"fileExceptionWhyChains": "optional"` in `disciplines.json`, an `authorised-location` may give only its `reason`. [The exceptions format](../../README.md#hone-records) gives each shape.
