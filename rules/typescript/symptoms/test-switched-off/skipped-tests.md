# skipped-tests

```json
{
  "misses": "`.todo`.",
  "settingsTracedTo": "`.todo` not flagged: a miss."
}
```

`.skip` or `.fixme` on a test or suite, or `xdescribe`, `xit`, `xtest`, `xsuite`.

## Flags
Needs ESLint adopted through the projection.
- Under ESLint, this check flags `.skip` and `.fixme` on those chains, and the bare names `xdescribe`, `xit`, `xtest` and `xsuite`.
- Not flagged: `.todo`, `.concurrent` and `.each`.
