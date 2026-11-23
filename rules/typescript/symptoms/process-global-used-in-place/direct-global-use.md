# direct-global-use

```json
{
  "misses": "Destructured aliases and calls through them.",
  "settingsTracedTo": "None."
}
```

Direct reads of process globals and direct console use.

A local value with the same name passes. Reads of globals still report after a TypeScript ambient declaration.
