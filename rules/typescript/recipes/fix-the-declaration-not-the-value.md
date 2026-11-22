# Fix the declaration, not the value

```json
{
  "serves": {
    "rule": "declared-not-asserted"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"the correct amount of casting is **0**\"; \"this feels like its hiding a problem with out modelling\".",
    "standing": "accepted"
  }
}
```

- **Method:** When a cast seems needed, narrow the declared input to the fields used, or tighten the generic so the checker proves it. No `as`, no `!`, no type guard of ours.
- **You can tell because:** Zero casts except `as const`.
- **Industry name:** none; ours.
