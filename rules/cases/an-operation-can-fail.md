# An operation can fail

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "the-type-checker-proves-it"
    },
    {
      "principle": "external-behaviour-sits-at-a-boundary"
    },
    {
      "rule": "failures-are-values"
    }
  ]
}
```

Every way it fails is a named variant in its return type. Nothing is thrown, ends the process, becomes true or false, or is swapped for a default or an empty value. Callers handle each variant.
