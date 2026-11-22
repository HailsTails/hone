# else-after-an-exit

```json
{}
```

An `else` after an `if` branch that always exits.

- **Misses:** an `if` nested with no `else`.
- **Settings traced to:** none.

## Flags

- The ESLint piece lints whatever files the team's ESLint run includes. It needs ESLint adopted through the projection; see the ESLint piece.
- Under ESLint, an `else` after an `if` branch that always exits is reported at the `else` keyword.
- A branch always exits when it ends in `return`, `throw`, `continue`, or `break` outside a switch. A nested `if` exits when both of its branches do. A `switch` exits when every non-empty case does.
- Along an `else if` chain whose earlier branches all exit, every `else` is reported.
- Allowed: an `else` after a branch that can fall through.

## Example

```ts
const label = (order: Order) => {
  if (order.cancelled) {
    return "cancelled";
  } else {
    return "active";
  }
};
```

## Fix

```ts
const label = (order: Order) => {
  if (order.cancelled) return "cancelled";
  return "active";
};
```
Handle the unhappy path first with an early return and leave the happy path as the final return.
