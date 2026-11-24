# Named, exported type

```json
{
  "serves": [
    {
      "rule": "declared-not-asserted"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "A derived type couples the consumer to the producer's implementation, not its contract.",
    "standing": "proposed"
  }
}
```

- **Method:** Declare and export a named type. Annotate the factory and its return with it. Never `ReturnType<typeof x>`.
- **You can tell because:** Every type a unit returns has its own name.
- **Industry name:** none; ours.
