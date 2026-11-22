# Composed orchestrator

```json
{
  "serves": {
    "rule": "doer-or-orchestrator"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"If it's long it's doing too many things inline. I hold to functions are doers or are orchestrator a teaching.\"",
    "standing": "accepted"
  }
}
```

- **Method:** An orchestrator's body is a sequence of named calls to our units. Each failed result returns at once, unchanged. Any computing or branching between calls moves into a named doer.
- **You can tell because:** The orchestrator holds calls, early returns of failures, and a final return.
- **Industry name:** the Integration Operation Segregation Principle (Westphal); Composed Method (Beck).
