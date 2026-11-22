# Type derived from code

```json
{
  "group": "Claimed or loose types",
  "seen": "`ReturnType<typeof x>`, `Parameters<typeof x>` or `typeof x` used as a type of our own.",
  "mayIndicate": [
    {
      "case": "gives-a-value-its-type",
      "points": [
        {
          "rule": "declared-not-asserted"
        }
      ]
    },
    {
      "case": "names-something",
      "points": [
        {
          "rule": "one-word-everywhere"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the producer, which has no named type",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "named-exported-type"
  ],
  "correctUses": [
    {
      "situation": "correct use",
      "kind": "authorised-location",
      "at": "in the adapter for an outside dependency that gives no named type"
    }
  ]
}
```
