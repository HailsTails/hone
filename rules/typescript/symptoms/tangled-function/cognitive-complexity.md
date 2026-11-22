# cognitive-complexity

```json
{}
```

A function whose cognitive complexity is above 15.

- **Settings traced to:** complexity 15: where a broad symptom fires (as above).

## Flags

- The ESLint piece lints whatever files the team's ESLint run includes. It needs ESLint adopted through the projection; see the ESLint piece.
- Under ESLint, each function's cognitive complexity must be at most 15.
  - An `if`, `else if`, `switch`, ternary, `catch` and each loop adds 1 plus the current nesting depth.
  - An `else`, a `finally`, a labelled `break` or `continue`, and each run of the same logical operator add 1.
  - Nesting deepens inside `if`, loops, `switch`, `catch` and ternaries.
  - A nested function is scored on its own, starting one level deeper, and its score is not added to its parent.
  - Reported at the function's name.

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
