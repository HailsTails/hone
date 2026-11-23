# random-call

```json
{
  "misses": "Calls through local variable aliases of an ambient function.",
  "settingsTracedTo": "None."
}
```

Direct calls to `Math.random`, `crypto.randomUUID` and `crypto.getRandomValues`. The crypto calls include `globalThis.crypto`, `window.crypto` and value imports from Node crypto. Locally bound receivers pass.
