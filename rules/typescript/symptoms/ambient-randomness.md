# Ambient randomness

```json
{
  "group": "The outside world reached directly",
  "seen": "`Math.random()`, `crypto.randomUUID()` or `crypto.getRandomValues()` outside their adapter.",
  "mayIndicate": [
    {
      "case": "needs-the-current-time-a-random-value-a-new-id-or-an-outside-ordering",
      "points": [
        {
          "rule": "ports-declared-inside"
        },
        {
          "rule": "written-out-answers"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit that should be passed the value, often a doer doing two jobs",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "world-values-through-a-port"
  ],
  "correctUses": [
    {
      "situation": "correct use",
      "kind": "boundary-record",
      "at": "on the adapter for random values or new ids"
    }
  ]
}
```
