# assertion-site

```json
{
  "misses": "Assertions called through another wrapper or a Vitest namespace import. A test registered through a shared fixture module or a mutable alias may be reported as outside a test. Asymmetric matchers and extension registration do not assert.",
  "settingsTracedTo": "None."
}
```

An assertion in a hook, suite body or helper is detached from the test whose result it should determine. Put it in the case that exercises the behavior.
