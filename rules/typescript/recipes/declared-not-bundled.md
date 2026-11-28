# Declared, not bundled

```json
{
  "serves": [
    {
      "rule": "shipped-risk-declared"
    }
  ],
  "standing": "proposed",
  "reason": {
    "text": "\"Do we still bundle Zod which means a Zod cve won't show up accurately?\"; \"Otherwise we ship as a peer dependency declaration only.\"",
    "standing": "accepted"
  }
}
```

- **Method:** A published package bundles no dependency. Each one is a pinned `dependencies` entry or a `peerDependencies` declaration.
- **Industry name:** Twelve-Factor, Dependencies.
