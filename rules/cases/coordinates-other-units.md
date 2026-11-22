# Coordinates other units

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "one-place-decides"
    },
    {
      "principle": "tests-are-ours"
    },
    {
      "rule": "doer-or-orchestrator"
    }
  ]
}
```

It picks which of our units run, in what order, and passes their results on. Branching, computing or reshaping between calls is its own unit. A unit that only forwards one call decides nothing: fold it in. A test suite's body is a list of cases, not a coordinator.
