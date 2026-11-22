# Checks conditions before its work

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "one-place-decides"
    },
    {
      "principle": "the-type-checker-proves-it"
    },
    {
      "rule": "guard-first"
    }
  ]
}
```

Each condition that ends the work returns at once, at one level. The work is the last return, never nested in a condition.
