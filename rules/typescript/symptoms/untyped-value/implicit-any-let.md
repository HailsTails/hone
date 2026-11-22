# implicit-any-let

```json
{
  "settingsTracedTo": "none."
}
```

A `let` or `var` with neither a type annotation nor an initialiser.

## Flags
Needs ESLint adopted through the projection.
- Under ESLint, this flags a `let` or `var` declaration in a `.ts` or `.tsx` file that has neither a type annotation nor an initialiser, one report per declaration at its first such binding. Declaration files (`.d.ts`), `const`, and `for-in` and `for-of` heads are not flagged.
- Allowed: `unknown`, `let total = 0` and `let total: number`.
