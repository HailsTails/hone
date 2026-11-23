# skipped-tests

```json
{
  "misses": "Test calls made through aliased names.",
  "settingsTracedTo": "The edition preserves the published edition 1 behaviour for adopters."
}
```

Edition 1 flags `.skip`, `.fixme`, `xdescribe`, `xit`, `xtest` and `xsuite`. Edition 2 also flags `.todo`, `.skipIf` and `.runIf`. A test should run wherever the suite runs.

Needs ESLint adopted through the projection.
