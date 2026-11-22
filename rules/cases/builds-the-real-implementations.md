# Builds the real implementations

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "one-place-decides"
    },
    {
      "principle": "external-behaviour-sits-at-a-boundary"
    },
    {
      "rule": "doer-or-orchestrator"
    },
    {
      "rule": "ports-declared-inside"
    }
  ]
}
```

One place, at start-up, builds every real implementation and passes it in. Nothing else builds one.

- **Review:** each injected port ships one default production factory
