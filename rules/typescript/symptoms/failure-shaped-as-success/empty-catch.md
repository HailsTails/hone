# empty-catch

```json
{
  "misses": "A handler that returns a success-shaped default or whose body cannot be seen at the call site.",
  "settingsTracedTo": "None."
}
```

An empty catch block or promise rejection handler drops the failure so callers can continue as if the operation succeeded. Return a failure value or leave handling to the boundary that can act on it.
