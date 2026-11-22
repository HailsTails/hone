# cast-to-any

```json
{}
```

A type assertion whose type contains `any`.

- **Misses:** `any` reached through an outside dependency's types.
- **Settings traced to:** `as const` allowed: Declared, not asserted.

## Flags
- `.ts` and `.tsx` files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A type assertion (`x as T` or `<T>x`) whose type contains the `any` keyword at any depth: `as any`, `<any>x`, `as Array<any>`, `as Record<string, any>`, `as Map<string, any>` or `as { field: any }`. The check reads the syntax tree, so an `any` elsewhere on the line is not attributed to the cast.
- This check judges these before [unlisted-cast-site](unlisted-cast-site.md) and has no settings; every other assertion is [unlisted-cast-site](unlisted-cast-site.md)'s.
- A bare annotation such as `let value: any` is not flagged by this check; [explicit-any](../untyped-value/explicit-any.md) covers it.

## Example
```ts
const parsed = JSON.parse(text) as any;
```

## Fix
```ts
const order = orderSchema.parse(JSON.parse(text));
```
Give it a concrete type where it enters: parse it once with a schema in the adapter for whoever produced it, checked at runtime.

In a test file, edition 2 of [the test-body check](../text-past-its-reader/test-body.md#serialising-or-parsing-json) flags `JSON.parse`; edition 1, the default, does not.
