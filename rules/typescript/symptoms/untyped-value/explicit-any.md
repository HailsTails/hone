# explicit-any

```json
{
  "settingsTracedTo": "none."
}
```

An `any` type anywhere in a type position.

## Flags
Needs ESLint adopted through the projection.
- Under ESLint, this is typescript-eslint's `no-explicit-any` with default options. It flags every `any` type: annotations, type arguments such as `Map<string, any>`, and `as any`.
- Allowed: `unknown`, `let total = 0` and `let total: number`.
