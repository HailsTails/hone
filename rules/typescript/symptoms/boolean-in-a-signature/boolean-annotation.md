# boolean-annotation

```json
{}
```

A boolean type in a parameter, property signature or return.

- **Flags beyond the symptom:** a predicate's boolean return.
- **Settings traced to:** none.

## Flags

- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A declared type of `boolean`, or `boolean` unioned only with `null` and `undefined`, on a parameter, an interface or type-literal property, a function, method, arrow or accessor return, or a function, call or index signature.
- Allowed: `true` or `false` literals, `boolean | string`, aliases of boolean, type predicates such as `value is Item`, inferred types, variables and class fields.
- All boolean signatures are reported, including predicates such as `isReady(): boolean`. Telling evaluative booleans from state is left to review.

## Example

```ts
const render = (compact: boolean): string => "";
```

## Fix

```ts
const render = (mode: "compact" | "full"): string => "";
```
Name each state in the type.
