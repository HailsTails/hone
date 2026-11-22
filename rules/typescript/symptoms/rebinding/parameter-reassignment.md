# parameter-reassignment

```json
{
  "misses": "a local `let` in production.",
  "settingsTracedTo": "none."
}
```

Assigning to, incrementing or destructuring into a parameter itself.

## Flags

Needs ESLint adopted through the projection; see the ESLint piece.

- Under ESLint, this is ESLint's `no-param-reassign` with `{ "props": false }`.
- It flags assigning to a parameter, incrementing or decrementing it, and destructuring-assigning into it.
- A parameter's fields are not checked here; the audit's [`parameter-mutation`](../write-into-a-parameter/parameter-mutation.md) clause covers them.
