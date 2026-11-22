# Zod at the producer's adapter

```json
{
  "serves": {
    "principle": "no-leak-across-a-boundary"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"my insistence on not writing complex logic to parse\"; \"Hand rolled is potentially a messy and lossy option?\"; \"Zod is the wire.\"",
    "standing": "accepted"
  }
}
```

- **Method:** The adapter for whoever produced the data parses it once with a Zod schema. The `z.infer` type is the wire type and stays in the adapter. The adapter maps it to a domain type of ours. A missing required value, environment included, is a failure, never a default.
- **You can tell because:** No schema, `z.infer` type or text past the adapter. Each crossing is parsed once.
- **Industry name:** parse, don't validate (King).
- **Review:** every crossing from the untyped outside world is schema-validated at the seam
