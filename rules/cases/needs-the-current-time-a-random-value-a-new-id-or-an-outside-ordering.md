# Needs the current time, a random value, a new id or an outside ordering

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "external-behaviour-sits-at-a-boundary"
    },
    {
      "principle": "one-place-decides"
    },
    {
      "principle": "tests-are-ours"
    },
    {
      "rule": "written-out-answers"
    },
    {
      "rule": "ports-declared-inside"
    }
  ]
}
```

One unit makes the value and does nothing else. Every other unit is passed the value, not its source. The source is a port; its stub returns a written-out value.
