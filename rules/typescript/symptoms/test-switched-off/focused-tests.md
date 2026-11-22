# focused-tests

```json
{
  "misses": "`.todo`.",
  "settingsTracedTo": "`.todo` not flagged: a miss."
}
```

`.only` on a test or suite, or `fdescribe`, `fit`, `ftest`, `fsuite`.

## Flags
Needs ESLint adopted through the projection.
- Under ESLint, this check flags `.only` on a `describe`, `it`, `test` or `suite` chain, including `.only.each` and `test.describe.only`, and the bare names `fdescribe`, `fit`, `ftest` and `fsuite`. It reports at the `only` token.
- Not flagged: `.todo`, `.concurrent` and `.each`.
