# Date used directly

```json
{
  "group": "The outside world reached directly",
  "seen": "Any use of `Date` (`Date.now()`, `new Date()`, `new Date(value)`, `Date.parse`) or `performance.now()` outside the places that handle dates.",
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
    },
    {
      "case": "does-one-job",
      "points": [
        {
          "rule": "doer-or-orchestrator"
        }
      ],
      "quote": "Dating and numbering an order is not the same job as charging it"
    }
  ],
  "breachUsuallySits": "in the unit that should be passed the time, often a doer doing two jobs",
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
      "at": "on the clock adapter"
    }
  ],
  "toNameTheBreach": "person."
}
```
