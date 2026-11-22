# loop-statement

```json
{}
```

`for...of`, `for await`, counted `for` and `while` loops.

- **Settings traced to:** none.

## Flags

- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Lines matching `for (... of ...)` (with or without `await`), `for (init; test; step)` and `while (`. This includes `do...while`. Each kind is reported once per line.
- Matching is on raw lines, so loop headers split over several lines are missed and the same text inside a string is flagged. Comment lines are ignored.
- The source rule names element and counted iteration; the check also flags `while`.
- Draining an `AsyncIterable` with `for await` is allowed by the rule at declared sites; record it as an `authorised-location`.

## Example

```ts
for (const order of orders) {
  totals.push(order.total);
}
```

## Fix

```ts
const totals = orders.map((order) => order.total);
```
Replace a counted loop with `Array.from({ length }, (_, position) => ...)`.

In a test file, the [computed-value-in-a-test check](../computed-value-in-a-test/test-body.md) flags `map` at either edition, and its edition 2 flags `Array.from`: write the values out instead, as [the allowed forms in a test](../computed-value-in-a-test/test-body.md#allowed-forms-in-a-test) show.
