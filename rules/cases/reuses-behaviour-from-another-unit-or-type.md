# Reuses behaviour from another unit or type

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "one-place-decides"
    },
    {
      "principle": "our-code-reads-in-the-common-language"
    },
    {
      "rule": "one-reason-per-module"
    }
  ]
}
```

Two callers share a unit only when it is one decision for both. Shared behaviour is a call to that unit, never inheritance.
