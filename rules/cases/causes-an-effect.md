# Causes an effect (writes, logs, sends, exits)

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "no-hidden-effects"
    },
    {
      "principle": "external-behaviour-sits-at-a-boundary"
    },
    {
      "principle": "one-place-decides"
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

The effect is a call on a port passed in, and its test checks that call.
