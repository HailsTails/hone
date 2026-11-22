# Doer or orchestrator

```json
{
  "principle": "one-place-decides",
  "standing": "accepted",
  "lenses": [
    "decomposition"
  ]
}
```

- **What must hold:** An orchestrator only calls our own units, on one value or on each of several, and passes each result on, a failed one returned unchanged. A doer calls, or hands to anything that calls, no unit of ours but an adapter, reached through a port passed in.
- **Source:** This is Westphal's Integration Operation Segregation Principle.

- **Review:** an orchestrator only composes helper calls and assembles their results
