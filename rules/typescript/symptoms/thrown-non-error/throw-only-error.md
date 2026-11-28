# throw-only-error

```json
{
  "settingsTracedTo": "none."
}
```

A `throw` of something that is not an error object.

## Flags
Needs ESLint adopted through the projection.
- Under ESLint, a `throw` of a literal, an object literal, a binary expression, a template or tagged template, or `undefined` is flagged. It follows the thrown value through `a ? b : c`, `a || b`, assignment and sequence expressions.
- Allowed: `new Error(...)`, identifiers, calls and member access.
- This check applies to every file the ESLint run includes, not only tests.
