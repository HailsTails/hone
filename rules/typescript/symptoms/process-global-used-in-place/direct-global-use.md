# direct-global-use

```json
{
  "misses": "Destructured aliases and calls through them.",
  "settingsTracedTo": "None."
}
```

Direct reads of process globals and direct console use.

A local binding with the same name passes. A test that writes to the ambient `process.env` can also report under [module or global patched](../module-or-global-patched/module-mock-call.md) when edition 2 of that check is selected.
