# Gives a value its type (declares it, or needs it narrower)

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "the-type-checker-proves-it"
    },
    {
      "principle": "one-place-decides"
    },
    {
      "principle": "no-leak-across-a-boundary"
    },
    {
      "rule": "handed-what-it-uses"
    },
    {
      "rule": "declared-not-asserted"
    }
  ]
}
```

It admits exactly what the code relies on, named, never derived from an implementation. To narrow it, fix the declaration or the parse; nothing asserts over it, tests included. A doer takes only the fields it reads.
