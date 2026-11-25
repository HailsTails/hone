# Composition root

```json
{
  "serves": [
    {
      "rule": "ports-declared-inside"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "If a unit builds its own adapter, it imports it, so the port is not passed in and the test cannot stub it.",
    "standing": "proposed"
  }
}
```

- **Method:** One entry-point module builds every adapter and passes each one in.
- **You can tell because:** No other module calls an adapter's factory.
- **Industry name:** Composition Root (Seemann).
