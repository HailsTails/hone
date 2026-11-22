# focused-tests

```json
{}
```

`.only` on a test or suite, or `fdescribe`, `fit`, `ftest`, `fsuite`.

- **Misses:** `.todo`.
- **Settings traced to:** `.todo` not flagged: a miss.

## Flags
Needs ESLint adopted through the projection.
- Under ESLint, this check flags `.only` on a `describe`, `it`, `test` or `suite` chain, including `.only.each` and `test.describe.only`, and the bare names `fdescribe`, `fit`, `ftest` and `fsuite`. It reports at the `only` token.
- Not flagged: `.todo`, `.concurrent` and `.each`.
