# parameter-count

```json
{}
```

A function with more than two parameters.

- **Misses:** our own functions with exactly two parameters.
- **Settings traced to:** `max: 2`: a recorded compromise of the check, which cannot tell the two kinds apart. "Positional parameters is 2 because it flags functions designed to be used in native APIs even inline unnamed ones for things like map/reduce. Making 1 untenable."; "The check is not right. Its unable to distinguish.".

## Flags

- The ESLint piece lints whatever files the team's ESLint run includes. It needs ESLint adopted through the projection; see the ESLint piece.
- Under ESLint, this is typescript-eslint's `max-params` with `{ "max": 2, "countVoidThis": true }`.
- A function declaration, function expression, arrow function, method or constructor with more than two parameters. A `this` parameter counts.
- Not flagged by the check: functions with two or fewer parameters. The rule asks for one named object; a function with two parameters is left to review, where the function-first lens treats every authored function with two or more parameters as a candidate.

## Example

```ts
const createOrder = (customerId: string, items: Item[], currency: string) => ({ customerId, items, currency });
```

## Fix

```ts
const createOrder = ({ customerId, items, currency }: OrderRequest) => ({ customerId, items, currency });
```
Take one object with named fields so each call site reads as a labelled contract.
