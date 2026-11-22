# Shared strict base config

```json
{
  "serves": {
    "rule": "declared-not-asserted"
  },
  "standing": "accepted",
  "reason": {
    "text": "One place sets strictness, so no project weakens it unseen.",
    "standing": "proposed"
  }
}
```

- **Method:** All strict flags sit in one base config that every `tsconfig.json` extends. No file turns one off.
- **You can tell because:** The resolved config of every project has every flag on.
- **Industry name:** none; ours.

[Zod at the producer's adapter](zod-at-the-producers-adapter.md) and [Assert to narrow](assert-to-narrow.md) also serve this rule. The framework's assertion is not a claim of ours.
