# Failures are values

```json
{
  "principle": "the-type-checker-proves-it",
  "standing": "accepted"
}
```

- **What must hold:** Between units of ours, every way an operation can fail is a named variant in its return type, and no failure is returned as a success, a default or an empty value.
- **Source:** Wlaschin's expected failures as values; Clean Code teaches exceptions instead.
- **Review:** expected operational failures are returned as a Result with a tagged error union, not thrown
