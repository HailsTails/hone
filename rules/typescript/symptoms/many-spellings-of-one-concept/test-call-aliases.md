# test-call-aliases

```json
{
  "misses": "Calls through a different local alias or a Vitest namespace import.",
  "settingsTracedTo": "None."
}
```

In a test file, a call rooted at `test` or `suite` refers to Vitest or has no local binding. Use `it` and `describe` so tests use the same names. Local bindings with other meanings pass.
