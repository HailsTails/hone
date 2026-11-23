# random-call

```json
{
  "misses": "Local variable aliases, self.crypto, and crypto obtained through ordinary require calls or dynamic imports.",
  "settingsTracedTo": "None."
}
```

Direct calls to `Math.random`, `crypto.randomUUID` and `crypto.getRandomValues`. The check follows `globalThis.crypto`, `window.crypto` and static Node crypto imports, including `import = require` and access through a module’s `webcrypto` export. Locally bound receivers from other sources pass.
