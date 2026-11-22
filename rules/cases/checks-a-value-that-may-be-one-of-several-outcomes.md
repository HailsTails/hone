# Checks a value that may be one of several outcomes

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "tests-are-ours"
    },
    {
      "principle": "the-type-checker-proves-it"
    },
    {
      "rule": "straight-through-tests"
    }
  ]
}
```

An assertion proves which outcome it is, so the type narrows; then the test reads it plainly. No condition, optional read or cast.
