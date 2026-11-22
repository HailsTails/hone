# Bounded context generic

```json
{
  "serves": {
    "rule": "declared-not-asserted"
  },
  "standing": "accepted",
  "reason": {
    "text": "A field read from an open context is either cast or defaulted. Both hide a missing capability until run time.",
    "standing": "proposed"
  }
}
```

- **Method:** A middleware that reads a context field takes a generic bounded so the field must exist. Each layer widens it.
- **You can tell because:** No middleware checks for, or defaults, a field it reads.
- **Industry name:** none; ours.
