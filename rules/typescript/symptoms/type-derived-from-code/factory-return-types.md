# factory-return-types

```json
{
  "flagsBeyondTheSymptom": "text in comments.",
  "misses": "`Parameters<typeof>`, `typeof` alone.",
  "settingsTracedTo": "none."
}
```

A line containing `ReturnType<typeof`.

## Flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Any line matching `ReturnType<typeof`, one finding per line. This includes `Awaited<ReturnType<typeof ...>>` and matches inside strings.
- Lines starting with `//`, `/*` or `*` are ignored. A `ReturnType<` and `typeof` split across lines are not seen.
- The source rule's carve-out, an external library symbol with no exported return type, is not detected; record it as an exception.

## Example
```ts
type Client = ReturnType<typeof createClient>;
```

## Fix
```ts
export type Client = { readonly send: (message: string) => void };
const createClient = (): Client => ({ send: () => undefined });
```
Declare and export the type, then annotate the factory with it.
