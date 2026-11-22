# function-length

```json
{
  "settingsTracedTo": "50 lines: where a broad symptom fires. \"Line and complexity are symptoms that flag many things.\" Suite bodies not measured: \"A test suite's body is a list of cases, not a coordinator.\"."
}
```

A function body longer than 50 lines.

## Flags

- The ESLint piece lints whatever files the team's ESLint run includes. It needs ESLint adopted through the projection; see the ESLint piece.
- Under ESLint, a function body may span at most 50 lines. Blank and comment lines count; lines holding only `{` or `}` do not. Getters and setters are not checked. Reported at the function.
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

## Example

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

## Fix

```ts
const settle = (orders: Order[]) => orders.filter(isPaid).forEach(refundEligibleLines);
```
Move any computing or branching between calls into a named doer, so the orchestrator only composes calls.
