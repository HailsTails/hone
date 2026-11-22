# Failure asserted as a value

```json
{
  "serves": {
    "rule": "straight-through-tests"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"more error throwing, not allowed\". A `try` or `catch` in a test is a branch that decides whether the test passes.",
    "standing": "proposed"
  }
}
```

- **Method:** A failure is checked as the returned variant: `expect(result).toEqual({ outcome: "failure", ... })`. An adapter whose caller's contract is a throw is checked with `expect(call).toThrow(...)`.
- **You can tell because:** No `try`, `catch` or `throw` in any test.
- **Industry name:** none; it follows from Failures are values.
