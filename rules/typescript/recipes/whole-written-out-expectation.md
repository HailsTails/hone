# Whole written-out expectation

```json
{
  "serves": {
    "rule": "straight-through-tests"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"no find, use bare access in tests for determinstic insistence on behaviours\".",
    "standing": "accepted"
  }
}
```

- **Method:** Assert the whole returned value with `toEqual` against a written-out literal. Read list items by bare index after an assert, never with `find`.
- **You can tell because:** The expected value is a literal in the test.
- **Industry name:** Literal Value (Meszaros).
