# Declared, not asserted

```json
{
  "principle": "the-type-checker-proves-it",
  "standing": "accepted"
}
```

- **What must hold:** A value's type comes only from a declaration of our own, never derived from an implementation, or from a parse at a boundary; no code of ours claims a type the checker does not verify.
- **Source:** King's parse, don't validate.
