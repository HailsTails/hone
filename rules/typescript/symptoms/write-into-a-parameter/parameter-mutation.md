# parameter-mutation

```json
{}
```

Assignment to, deletion from or in-place methods on a parameter's fields.

- **Settings traced to:** none.

## Flags

- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Inside a function declaration, function expression, arrow function or method, where the root name is one of its parameters (including destructured and outer-function parameters):
  - `parameter.field = value` and `parameter.a[0].b = value`
  - `delete parameter.field`
  - `parameter.push(...)`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`
- Not detected: reassigning the parameter, `+=` and `++`, `Map.set`, and mutation through an alias (`const copy = input; copy.x = 1`).

## Example

```ts
const addTotal = (order: Order) => {
  order.total = 10;
};
```

## Fix

```ts
const withTotal = (order: Order): Order => ({ ...order, total: 10 });
```
Copy before sorting or reversing: `[...items].sort()`.
